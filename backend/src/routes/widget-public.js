import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../db.js';
import { searchKnowledge } from '../lib/knowledge-search.js';
import { detectLanguage, generateResponse, languageInstruction, responseGuardrails, unavailableReply } from '../lib/ai.js';
import { detectHumanRequest, resolveEscalation, buildEscalationMessage } from '../lib/escalation.js';
import { HANDOFF_EVENT, publishHandoffEvent, notifyHandoff, subscribeToWidget } from '../lib/handoff-bus.js';
import { openSse, sendSse, closeSse, startHeartbeat } from '../lib/sse.js';

const router = Router();

async function findLiveHandoff(widgetId, visitorId) {
  try {
    return await prisma.handoff.findFirst({
      where: { widgetId, visitorId, status: { in: ['pending', 'active'] } },
      orderBy: { createdAt: 'desc' },
    });
  } catch (err) {
    console.error('Handoff lookup error:', err);
    return null;
  }
}

async function appendToConversation(conversationId, entry) {
  if (!conversationId) return;
  try {
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { messages: true },
    });
    const messages = Array.isArray(convo?.messages) ? convo.messages : [];
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { messages: [...messages, entry], updatedAt: new Date() },
    });
  } catch (err) {
    console.error('Handoff conversation append error:', err);
  }
}

router.get('/:slug/config', async (req, res) => {
  try {
    const widget = await prisma.widget.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        config: true,
      },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const cfg = widget.config;
    // The tracking code is generated on the first visitor message (POST /chat),
    // not on config load, so a widget that is only previewed never gets a hash.
    const ticketHash = cfg.ticketHash || '';
    res.json({
      widgetId: widget.id,
      ticketHash,
      personality: cfg.personality || {},
      behavior: cfg.behavior || {},
      appearance: cfg.appearance || {},
    });
  } catch (err) {
    console.error('Public config error:', err);
    res.status(500).json({ error: 'Failed to load widget config' });
  }
});

// Visitor-side live channel: pushes the operator's replies (and the end of the
// human takeover) to the widget that asked for a human.
router.get('/:slug/handoffs/stream', async (req, res) => {
  try {
    const visitorId = String(req.query.visitorId || '');
    if (!visitorId) return res.status(400).json({ error: 'visitorId is required' });

    const widget = await prisma.widget.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    openSse(res);
    const stopHeartbeat = startHeartbeat(res);

    const unsubscribe = subscribeVisitor(widget.id, visitorId, res);

    req.on('close', () => {
      stopHeartbeat();
      unsubscribe();
      closeSse(res);
    });
  } catch (err) {
    console.error('Public handoff stream error:', err);
    res.status(500).json({ error: 'Failed to open handoff stream' });
  }
});

function subscribeVisitor(widgetId, visitorId, res) {
  return subscribeToWidget(widgetId, ({ event, payload }) => {
    if (!payload || payload.visitorId !== visitorId) return;
    if (event === HANDOFF_EVENT.NEW) return;
    sendSse(res, event, payload);
  });
}

router.post('/:slug/chat', async (req, res) => {
  try {
    const { message, visitorId, context, history, escalate, handoff } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const vId = visitorId || randomUUID();

    const widget = await prisma.widget.findUnique({
      where: { slug: req.params.slug },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const cfg = widget.config || {};
    const aiConfig = cfg.ai || {};
    const personality = cfg.personality || {};
    const escalation = resolveEscalation(aiConfig.escalation || {});

    // Resolve the widget's tracking hash (generate + persist once if missing).
    let ticketHash = cfg.ticketHash || '';
    if (!ticketHash) {
      ticketHash = randomUUID().slice(0, 8);
      try {
        await prisma.widget.update({
          where: { id: widget.id },
          data: { config: { ...widget.config, ticketHash } },
        });
      } catch (persistErr) {
        console.error('ticketHash persist error:', persistErr);
      }
    }

    // A human is already handling this visitor: the message goes to the
    // operator, never to the AI.
    const liveHandoff = await findLiveHandoff(widget.id, vId);
    if (liveHandoff && (liveHandoff.status === 'active' || handoff === true)) {
      const entry = { role: 'user', content: message, timestamp: new Date().toISOString() };
      await appendToConversation(liveHandoff.conversationId, entry);
      publishHandoffEvent(widget.id, HANDOFF_EVENT.VISITOR_MESSAGE, {
        handoffId: liveHandoff.id,
        visitorId: vId,
        conversationId: liveHandoff.conversationId,
        message: entry,
      });
      return res.json({
        response: '',
        conversationId: liveHandoff.conversationId || null,
        visitorId: vId,
        escalation: { available: false },
        handoff: { active: true, handoffId: liveHandoff.id },
      });
    }

    const knowledgeEntries = await prisma.knowledgeEntry.findMany({
      where: { widgetId: widget.id },
    });

    // Explicit human request (typed by the visitor, or triggered by the
    // widget's "talk to a human" action) → hand off without an AI call.
    const humanRequested = escalate === true || detectHumanRequest(message);

    const relevantKnowledge = searchKnowledge(message, knowledgeEntries, 3);
    const supportEntry = knowledgeEntries.find(k => /contact|support|تماس|پشتیبانی/i.test(k.title));
    if (supportEntry && !relevantKnowledge.includes(supportEntry)) {
      relevantKnowledge.push(supportEntry);
    }
    const escalationMessage = humanRequested && escalation.enabled
      ? buildEscalationMessage(escalation, {
          knowledgeContact: supportEntry ? `${supportEntry.title}: ${supportEntry.content}` : '',
        })
      : null;
    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      knowledgeContext = '\n\nRelevant information from the site knowledge base:\n' +
        relevantKnowledge.map(k => `- ${k.title}: ${k.content}`).join('\n');
    }

    let pageContext = '';
    if (context) {
      const parts = [];
      if (context.pageUrl) parts.push(`Page URL: ${context.pageUrl}`);
      if (context.pageTitle) parts.push(`Page title: ${context.pageTitle}`);
      if (context.metadata) parts.push(`Additional context: ${JSON.stringify(context.metadata)}`);
      if (parts.length) {
        pageContext = '\n\nCurrent page context:\n' + parts.join('\n');
      }
    }

    const systemPrompt = (aiConfig.systemPrompt || 'You are a helpful website assistant.') +
      knowledgeContext +
      pageContext +
      `\n\n${responseGuardrails()}\n\n` +
      `You are "${personality.name || 'Assistant'}" with a ${personality.tone || 'friendly'} tone.`;

    const conversationMessages = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        conversationMessages.push({
          role: msg.role === 'assistant' || msg.role === 'operator' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }
    conversationMessages.push({ role: 'user', content: message });

    // ---- Persist the visitor's message BEFORE the answer path ----
    // Best-effort: a DB failure keeps conversationId = null and we still answer.
    let conversationId;
    const userEntry = { role: 'user', content: message, timestamp: new Date().toISOString() };
    try {
      const existingConvo = context?.conversationId
        ? await prisma.conversation.findUnique({ where: { id: context.conversationId } })
        : null;

      if (existingConvo) {
        await appendToConversation(existingConvo.id, userEntry);
        conversationId = existingConvo.id;
      } else {
        const convo = await prisma.conversation.create({
          data: {
            widgetId: widget.id,
            visitorId: vId,
            ticketHash,
            messages: [...(history || []), userEntry],
            pageUrl: context?.pageUrl || null,
            pageTitle: context?.pageTitle || null,
          },
        });
        conversationId = convo.id;
      }
    } catch (writeErr) {
      console.error('Chat persistence error:', writeErr);
      conversationId = null;
    }

    // ---- Answer path ----
    let aiResult;
    let assistantEntry;
    if (escalationMessage) {
      aiResult = { content: escalationMessage, usage: null };
      assistantEntry = { role: 'assistant', content: escalationMessage, timestamp: new Date().toISOString() };
    } else {
      try {
        aiResult = await generateResponse({
          systemPrompt: `${systemPrompt}\n\n${languageInstruction(message)}`,
          messages: conversationMessages,
          temperature: aiConfig.temperature || 0.7,
          maxTokens: aiConfig.maxTokens || 500,
        });
        assistantEntry = { role: 'assistant', content: aiResult.content, timestamp: new Date().toISOString() };
      } catch (aiErr) {
        console.error('AI provider error:', aiErr);
        const lang = detectLanguage(message);
        const fallback = unavailableReply(lang, escalation);
        assistantEntry = { role: 'assistant', content: fallback, timestamp: new Date().toISOString() };
        aiResult = { content: fallback, usage: null };

        // Persist the fallback reply so the visitor message is never lost.
        try {
          if (conversationId) await appendToConversation(conversationId, assistantEntry);
        } catch (appendErr) {
          console.error('Fallback append error:', appendErr);
        }

        // Open a pending handoff so the message reaches Live Inbox.
        let failureHandoffPayload = { active: false, pending: false, handoffId: null };
        try {
          const handoff = await prisma.handoff.create({
            data: {
              widgetId: widget.id,
              conversationId,
              visitorId: vId,
              message,
              status: 'pending',
            },
          });
          failureHandoffPayload = { active: false, pending: true, handoffId: handoff.id };
          publishHandoffEvent(widget.id, HANDOFF_EVENT.NEW, {
            handoff,
            visitorId: vId,
            conversationId,
          });
          notifyHandoff(handoff);
        } catch (handoffErr) {
          console.error('Handoff creation error:', handoffErr);
        }

        return res.json({
          response: fallback,
          conversationId,
          visitorId: vId,
          escalation: { available: false },
          handoff: failureHandoffPayload,
        });
      }
    }

    // Append the assistant reply (escalation message or AI answer) best-effort.
    try {
      if (conversationId) await appendToConversation(conversationId, assistantEntry);
    } catch (appendErr) {
      console.error('Assistant append error:', appendErr);
    }

    // A human was requested: open a handoff so the operator is notified in real
    // time and can take over the conversation.
    let handoffPayload = { active: false, pending: false, handoffId: null };
    if (escalationMessage) {
      try {
        const handoff = await prisma.handoff.create({
          data: {
            widgetId: widget.id,
            conversationId,
            visitorId: vId,
            message,
            status: 'pending',
          },
        });
        handoffPayload = { active: false, pending: true, handoffId: handoff.id };
        publishHandoffEvent(widget.id, HANDOFF_EVENT.NEW, {
          handoff,
          visitorId: vId,
          conversationId,
        });
        notifyHandoff(handoff);
      } catch (handoffErr) {
        console.error('Handoff creation error:', handoffErr);
      }
    } else if (liveHandoff) {
      // Still pending: let the operator see what the visitor is saying meanwhile.
      publishHandoffEvent(widget.id, HANDOFF_EVENT.VISITOR_MESSAGE, {
        handoffId: liveHandoff.id,
        visitorId: vId,
        conversationId: liveHandoff.conversationId,
        message: userEntry,
      });
    }

    res.json({
      response: aiResult.content,
      conversationId,
      visitorId: vId,
      ticketHash,
      escalation: { available: escalation.enabled && !liveHandoff },
      handoff: handoffPayload,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Visitor closes their current ticket: closes the latest open conversation,
// ends any active/pending human handoff, and regenerates the ticket hash so the
// next ticket gets a new tracking code.
router.post('/:slug/chat/close', async (req, res) => {
  try {
    const { visitorId } = req.body || {};
    if (!visitorId) return res.status(400).json({ error: 'visitorId is required' });

    const widget = await prisma.widget.findUnique({
      where: { slug: req.params.slug },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const latestConvo = await prisma.conversation.findFirst({
      where: { widgetId: widget.id, visitorId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (latestConvo && latestConvo.status !== 'closed') {
      await prisma.conversation.update({
        where: { id: latestConvo.id },
        data: { status: 'closed', updatedAt: new Date() },
      });
    }

    const liveHandoff = await prisma.handoff.findFirst({
      where: { widgetId: widget.id, visitorId, status: { in: ['pending', 'active'] } },
    });
    if (liveHandoff) {
      await prisma.handoff.update({
        where: { id: liveHandoff.id },
        data: { status: 'ended', updatedAt: new Date() },
      });
      publishHandoffEvent(widget.id, HANDOFF_EVENT.ENDED, {
        handoff: { id: liveHandoff.id, status: 'ended' },
        handoffId: liveHandoff.id,
        visitorId,
      });
    }

    const newHash = randomUUID().slice(0, 8);
    try {
      await prisma.widget.update({
        where: { id: widget.id },
        data: { config: { ...widget.config, ticketHash: newHash } },
      });
    } catch (persistErr) {
      console.error('ticketHash regenerate error:', persistErr);
    }

    res.json({ success: true, ticketHash: newHash, closed: true });
  } catch (err) {
    console.error('Chat close error:', err);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

router.post('/:slug/events', async (req, res) => {
  try {
    const { eventType, metadata, visitorId, pageUrl } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType is required' });

    const widget = await prisma.widget.findUnique({ where: { slug: req.params.slug } });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    try {
      await prisma.analyticsEvent.create({
        data: {
          widgetId: widget.id,
          eventType,
          metadata: metadata || {},
          visitorId: visitorId || null,
          pageUrl: pageUrl || null,
        },
      });
      res.status(201).json({ success: true });
    } catch (writeErr) {
      console.error('Analytics persistence error:', writeErr);
      res.status(202).json({ success: true });
    }
  } catch (err) {
    console.error('Track event error:', err);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

export default router;
