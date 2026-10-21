import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';

// The test server runs against a dedicated Postgres schema so it can never
// touch production rows, and against a stub AI provider so the suite never
// burns the real provider's daily key budget.
const inDocker = existsSync('/.dockerenv');
const dbHost = inDocker ? 'ymls-pgsql-1:5432' : 'localhost:5432';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  `postgresql://jobvision:secret@${dbHost}/site_assistant?schema=test_handoff`;
process.env.JWT_SECRET = 'test-secret';
process.env.AI_BASE_URL = 'http://127.0.0.1:0';
process.env.AI_MODEL = 'test-model';

let app;
let prisma;
let server;
let baseUrl;
let aiCalls = [];

const stubProvider = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    aiCalls.push(JSON.parse(body || '{}'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{ message: { content: 'این یک پاسخ آزمایشی است.' } }],
      usage: { total_tokens: 10 },
    }));
  });
});

before(async () => {
  await new Promise((resolve) => stubProvider.listen(0, '127.0.0.1', resolve));
  const stubPort = stubProvider.address().port;
  process.env.AI_BASE_URL = `http://127.0.0.1:${stubPort}`;

  // The app reads config at import time, so it must be imported after the
  // environment above is set.
  const appModule = await import('../../src/app.js');
  app = appModule.app;
  prisma = (await import('../../src/db.js')).default;

  await prisma.$connect();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (prisma) await prisma.$disconnect();
  if (stubProvider) await new Promise((resolve) => stubProvider.close(resolve));
});

let seq = 0;
const uniq = () => `${Date.now()}-${seq++}`;

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, text };
}

async function setupWidget() {
  const email = `test-${uniq()}@example.com`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'secret123', name: 'Test User' },
  });
  assert.equal(reg.status, 201, `register failed: ${reg.text}`);

  const token = reg.data.token;
  const created = await api('/api/widgets', {
    method: 'POST',
    token,
    body: {
      name: 'Test Widget',
      config: { personality: { name: 'دستیار' } },
    },
  });
  assert.equal(created.status, 201, `create widget failed: ${created.text}`);

  const widget = created.data.widget;
  return { token, widget, email };
}

// Opens an SSE stream and returns { events, close }.
async function openStream(path) {
  const controller = new AbortController();
  const events = [];
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = null;
          let data = null;
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data = line.slice(5).trim();
          }
          if (event) {
            let parsed = null;
            try { parsed = JSON.parse(data); } catch {}
            events.push({ event, data: parsed });
          }
        }
      }
    } catch { /* aborted */ }
  })();

  return { events, close: () => controller.abort() };
}

const waitFor = (fn, timeoutMs = 4000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const v = fn();
      if (v) return resolve(v);
      if (Date.now() - started > timeoutMs) return reject(new Error('timed out waiting for event'));
      setTimeout(tick, 25);
    };
    tick();
  });

describe('human handoff flow', () => {
  test('escalate creates a pending handoff and returns the handoff id', async () => {
    const { widget } = await setupWidget();
    const visitorId = uniq();

    const res = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'می‌خواهم با پشتیبانی انسانی صحبت کنم', visitorId, escalate: true },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.handoff?.pending, true);
    assert.equal(res.data.handoff?.active, false);
    assert.ok(res.data.handoff?.handoffId, 'handoffId should be returned');
    assert.ok(res.data.response?.length, 'the visitor still gets the handoff message');

    const row = await prisma.handoff.findUnique({ where: { id: res.data.handoff.handoffId } });
    assert.ok(row, 'handoff row should exist');
    assert.equal(row.status, 'pending');
    assert.equal(row.visitorId, visitorId);
  });

  test('operator list endpoint is scoped to the widget owner', async () => {
    const { token, widget } = await setupWidget();
    const other = await setupWidget();

    await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'سلام، نیاز به کمک دارم', visitorId: uniq(), escalate: true },
    });

    const mine = await api(`/api/widgets/${widget.id}/handoffs`, { token });
    assert.equal(mine.status, 200);
    assert.equal(mine.data.handoffs.length, 1);

    const theirs = await api(`/api/widgets/${widget.id}/handoffs`, { token: other.token });
    assert.equal(theirs.status, 404, 'a non-owner must not see the handoff');
  });

  test('reply appends the operator message and activates the handoff', async () => {
    const { token, widget } = await setupWidget();
    const visitorId = uniq();

    const created = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'می‌خواهم با پشتیبانی صحبت کنم', visitorId, escalate: true },
    });
    const handoffId = created.data.handoff.handoffId;

    const reply = await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/reply`, {
      method: 'POST',
      token,
      body: { text: 'سلام! چطور می‌توانم کمکتان کنم؟' },
    });

    assert.equal(reply.status, 200);
    assert.equal(reply.data.success, true);
    assert.equal(reply.data.handoff.status, 'active');
    assert.equal(reply.data.message.role, 'operator');
    assert.equal(reply.data.message.content, 'سلام! چطور می‌توانم کمکتان کنم؟');
    assert.ok(reply.data.message.timestamp, 'the entry needs a timestamp for dedup');
  });

  test('reply requires a message body', async () => {
    const { token, widget } = await setupWidget();
    const created = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'کمک می‌خواهم', visitorId: uniq(), escalate: true },
    });

    const res = await api(`/api/widgets/${widget.id}/handoffs/${created.data.handoff.handoffId}/reply`, {
      method: 'POST',
      token,
      body: { text: '   ' },
    });
    assert.equal(res.status, 400);
  });

  test('visitor message during an active handoff goes to the operator, not the AI', async () => {
    const { token, widget } = await setupWidget();
    const visitorId = uniq();

    const created = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'می‌خواهم با اپراتور صحبت کنم', visitorId, escalate: true },
    });
    const handoffId = created.data.handoff.handoffId;

    await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/reply`, {
      method: 'POST',
      token,
      body: { text: 'سلام' },
    });

    const callsBefore = aiCalls.length;
    const res = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'درباره ساعات کاری می‌پرسم', visitorId, handoff: true },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.response, '', 'the AI must not answer during a handoff');
    assert.equal(res.data.handoff?.active, true);
    assert.equal(aiCalls.length, callsBefore, 'the AI provider must not be called');
  });

  test('operator sees the visitor message over SSE', async () => {
    const { token, widget } = await setupWidget();
    const visitorId = uniq();

    const stream = await openStream(`/api/widgets/${widget.id}/handoffs/stream?token=${token}`);
    try {
      const created = await api(`/api/public/widgets/${widget.slug}/chat`, {
        method: 'POST',
        body: { message: 'سلام، کمک می‌خواهم', visitorId, escalate: true },
      });
      const handoffId = created.data.handoff.handoffId;

      const newEvent = await waitFor(() => stream.events.find((e) => e.event === 'handoff_new'));
      assert.equal(newEvent.data.handoff.id, handoffId);
      assert.equal(newEvent.data.visitorId, visitorId);

      await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/reply`, {
        method: 'POST',
        token,
        body: { text: 'سلام، در خدمتم' },
      });
      const opEvent = await waitFor(() => stream.events.find((e) => e.event === 'operator_message'));
      assert.equal(opEvent.data.message.content, 'سلام، در خدمتم');

      await api(`/api/public/widgets/${widget.slug}/chat`, {
        method: 'POST',
        body: { message: 'یک سوال دارم', visitorId, handoff: true },
      });
      const visitorEvent = await waitFor(() => stream.events.find((e) => e.event === 'visitor_message'));
      assert.equal(visitorEvent.data.message.content, 'یک سوال دارم');

      await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/end`, { method: 'POST', token, body: {} });
      const endedEvent = await waitFor(() => stream.events.find((e) => e.event === 'handoff_ended'));
      assert.equal(endedEvent.data.handoff.status, 'ended');
    } finally {
      stream.close();
    }
  });

  test('visitor receives the operator reply over SSE', async () => {
    const { token, widget } = await setupWidget();
    const visitorId = uniq();

    const created = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'سلام', visitorId, escalate: true },
    });
    const handoffId = created.data.handoff.handoffId;

    const stream = await openStream(
      `/api/public/widgets/${widget.slug}/handoffs/stream?visitorId=${visitorId}`
    );
    try {
      await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/reply`, {
        method: 'POST',
        token,
        body: { text: 'سلام! چطور می‌توانم کمک کنم؟' },
      });

      const opEvent = await waitFor(() => stream.events.find((e) => e.event === 'operator_message'));
      assert.equal(opEvent.data.message.content, 'سلام! چطور می‌توانم کمک کنم؟');
    } finally {
      stream.close();
    }
  });

  test('the visitor stream does not leak other visitors traffic', async () => {
    const { token, widget } = await setupWidget();
    const myVisitor = uniq();
    const otherVisitor = uniq();

    const stream = await openStream(
      `/api/public/widgets/${widget.slug}/handoffs/stream?visitorId=${myVisitor}`
    );
    try {
      const other = await api(`/api/public/widgets/${widget.slug}/chat`, {
        method: 'POST',
        body: { message: 'پیام از بازدیدکننده دیگر', visitorId: otherVisitor, escalate: true },
      });

      await api(`/api/widgets/${widget.id}/handoffs/${other.data.handoff.handoffId}/reply`, {
        method: 'POST',
        token,
        body: { text: 'این پاسخ برای بازدیدکننده دیگر است' },
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      const leaked = stream.events.find((e) => e.event === 'operator_message');
      assert.equal(leaked, undefined, 'another visitor reply must not reach this stream');
    } finally {
      stream.close();
    }
  });

  test('after the handoff ends the AI answers normally again', async () => {
    const { token, widget } = await setupWidget();
    const visitorId = uniq();

    const created = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'می‌خواهم با پشتیبانی صحبت کنم', visitorId, escalate: true },
    });
    const handoffId = created.data.handoff.handoffId;

    await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/reply`, {
      method: 'POST',
      token,
      body: { text: 'سلام' },
    });
    await api(`/api/widgets/${widget.id}/handoffs/${handoffId}/end`, { method: 'POST', token, body: {} });

    const callsBefore = aiCalls.length;
    const res = await api(`/api/public/widgets/${widget.slug}/chat`, {
      method: 'POST',
      body: { message: 'سلام، حالا چطور کمکم می‌کنی؟', visitorId },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.handoff?.active, false);
    assert.ok(res.data.response?.length, 'the AI should answer again');
    assert.equal(aiCalls.length, callsBefore + 1, 'the AI provider should be called again');
  });

  test('the admin stream requires a valid token', async () => {
    const { widget } = await setupWidget();
    const res = await api(`/api/widgets/${widget.id}/handoffs/stream?token=not-a-jwt`);
    assert.equal(res.status, 401);
  });

  test('the admin stream is scoped to the widget owner', async () => {
    const { widget } = await setupWidget();
    const other = await setupWidget();
    const res = await api(
      `/api/widgets/${widget.id}/handoffs/stream?token=${other.token}`
    );
    assert.equal(res.status, 404, 'a non-owner must not open the stream');
  });

  test('the visitor stream requires a visitorId', async () => {
    const { widget } = await setupWidget();
    const res = await api(`/api/public/widgets/${widget.slug}/handoffs/stream`);
    assert.equal(res.status, 400);
  });
});
