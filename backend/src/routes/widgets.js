import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, verifyToken } from '../middleware/auth.js';
import { HANDOFF_EVENT, publishHandoffEvent, subscribeToWidget } from '../lib/handoff-bus.js';
import { openSse, sendSse, closeSse, startHeartbeat } from '../lib/sse.js';

const router = Router();

// The live inbox stream authenticates with ?token= because EventSource cannot
// send an Authorization header, so it is mounted before the header-only guard.
router.get('/:id/handoffs/stream', async (req, res) => {
  const user = verifyToken(String(req.query.token || ''));
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

  try {
    const widget = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true, name: true, slug: true },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    openSse(res);
    const stopHeartbeat = startHeartbeat(res);
    const unsubscribe = subscribeToWidget(widget.id, ({ event, payload }) => {
      sendSse(res, event, payload);
    });

    req.on('close', () => {
      stopHeartbeat();
      unsubscribe();
      closeSse(res);
    });
  } catch (err) {
    console.error('Handoff stream error:', err);
    res.status(500).json({ error: 'Failed to open handoff stream' });
  }
});

router.use(authMiddleware);

router.get('/:id/handoffs', async (req, res) => {
  try {
    const widget = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, name: true, slug: true },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const handoffs = await prisma.handoff.findMany({
      where: { widgetId: widget.id, status: { in: ['pending', 'active'] } },
      orderBy: { createdAt: 'desc' },
    });

    const withThreads = await Promise.all(handoffs.map(async (h) => {
      let thread = [];
      if (h.conversationId) {
        try {
          const convo = await prisma.conversation.findUnique({
            where: { id: h.conversationId },
            select: { messages: true },
          });
          thread = Array.isArray(convo?.messages) ? convo.messages : [];
        } catch (err) {
          console.error('Handoff thread read error:', err);
        }
      }
      return { ...h, thread };
    }));

    res.json({ handoffs: withThreads });
  } catch (err) {
    console.error('List handoffs error:', err);
    res.status(500).json({ error: 'Failed to list handoffs' });
  }
});

router.post('/:id/handoffs/:hid/reply', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const widget = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const handoff = await prisma.handoff.findFirst({
      where: { id: req.params.hid, widgetId: widget.id },
    });
    if (!handoff) return res.status(404).json({ error: 'Handoff not found' });

    const entry = {
      role: 'operator',
      content: String(text).trim(),
      timestamp: new Date().toISOString(),
      operatorId: req.user.id,
    };

    if (handoff.conversationId) {
      const convo = await prisma.conversation.findUnique({
        where: { id: handoff.conversationId },
        select: { messages: true },
      });
      const messages = Array.isArray(convo?.messages) ? convo.messages : [];
      await prisma.conversation.update({
        where: { id: handoff.conversationId },
        data: { messages: [...messages, entry], updatedAt: new Date() },
      });
    }

    const updated = await prisma.handoff.update({
      where: { id: handoff.id },
      data: { status: 'active', updatedAt: new Date() },
    });

    publishHandoffEvent(widget.id, HANDOFF_EVENT.UPDATE, {
      handoff: updated,
      visitorId: handoff.visitorId,
      message: entry,
    });
    publishHandoffEvent(widget.id, HANDOFF_EVENT.OPERATOR_MESSAGE, {
      handoffId: handoff.id,
      visitorId: handoff.visitorId,
      conversationId: handoff.conversationId,
      message: entry,
    });

    res.json({ success: true, handoff: updated, message: entry });
  } catch (err) {
    console.error('Handoff reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.post('/:id/handoffs/:hid/end', async (req, res) => {
  try {
    const widget = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const handoff = await prisma.handoff.findFirst({
      where: { id: req.params.hid, widgetId: widget.id },
    });
    if (!handoff) return res.status(404).json({ error: 'Handoff not found' });

    const updated = await prisma.handoff.update({
      where: { id: handoff.id },
      data: { status: 'ended', updatedAt: new Date() },
    });

    publishHandoffEvent(widget.id, HANDOFF_EVENT.ENDED, {
      handoff: updated,
      handoffId: handoff.id,
      visitorId: handoff.visitorId,
    });

    res.json({ success: true, handoff: updated });
  } catch (err) {
    console.error('Handoff end error:', err);
    res.status(500).json({ error: 'Failed to end handoff' });
  }
});

const DEFAULT_CONFIG = {
  personality: {
    name: 'Assistant',
    tone: 'friendly',
    avatarUrl: '',
    welcomeMessage: 'Hi there! How can I help you today?',
  },
  behavior: {
    proactiveTriggers: [
      { type: 'time_on_page', seconds: 45, message: 'Need any help finding what you\'re looking for?' },
      { type: 'scroll_depth', percent: 75, message: 'Looks like you\'re deep into things — want a hand?' },
    ],
    pageRules: [
      { urlPattern: '/pricing', message: 'Want me to walk you through our plans?' },
      { urlPattern: '/checkout', message: 'Need help with checkout?' },
      { urlPattern: '/docs', message: 'Looking for specific documentation?' },
    ],
  },
  ai: {
    systemPrompt: 'You are a helpful, concise website assistant. Answer questions about the website based on the provided context. Be friendly but not overly chatty. Keep responses under 3 sentences unless detail is requested.',
    temperature: 0.7,
    maxTokens: 500,
    escalation: {
      enabled: true,
      message: 'درخواست شما ثبت شد. کارشناسان ما در اسرع وقت با شما تماس می‌گیرند.',
      contact: '',
    },
  },
appearance: {
    position: 'left-edge',
    primaryColor: '#ef4444',
    fontFamily: 'system-ui, sans-serif',
    animationsEnabled: true,
    shape: 'half-circle',
    icon: 'bug',
  },
};

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 8);
}

router.get('/', async (req, res) => {
  try {
    const widgets = await prisma.widget.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, config: true, createdAt: true, updatedAt: true },
    });
    res.json({ widgets });
  } catch (err) {
    console.error('List widgets error:', err);
    res.status(500).json({ error: 'Failed to list widgets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, config: userConfig } = req.body;
    if (!name) return res.status(400).json({ error: 'Widget name is required' });

    const slug = generateSlug(name);
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      personality: { ...DEFAULT_CONFIG.personality, ...userConfig?.personality },
      behavior: { ...DEFAULT_CONFIG.behavior, ...userConfig?.behavior },
      ai: {
        ...DEFAULT_CONFIG.ai,
        ...userConfig?.ai,
        escalation: {
          ...DEFAULT_CONFIG.ai.escalation,
          ...userConfig?.ai?.escalation,
        },
      },
      appearance: { ...DEFAULT_CONFIG.appearance, ...userConfig?.appearance },
    };

    const widget = await prisma.widget.create({
      data: {
        userId: req.user.id,
        name,
        slug,
        config: mergedConfig,
      },
      select: { id: true, name: true, slug: true, config: true, createdAt: true },
    });
    res.status(201).json({ widget });
  } catch (err) {
    console.error('Create widget error:', err);
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const widget = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, name: true, slug: true, config: true, createdAt: true, updatedAt: true },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    res.json({ widget });
  } catch (err) {
    console.error('Get widget error:', err);
    res.status(500).json({ error: 'Failed to get widget' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, config: userConfig } = req.body;

    const existing = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Widget not found' });

    const updatedConfig = userConfig ? { ...(existing.config || {}), ...userConfig } : existing.config;

    const widget = await prisma.widget.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        config: updatedConfig,
      },
      select: { id: true, name: true, slug: true, config: true, createdAt: true, updatedAt: true },
    });
    res.json({ widget });
  } catch (err) {
    console.error('Update widget error:', err);
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.widget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Widget not found' });

    await prisma.widget.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete widget error:', err);
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

export default router;
