import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../db.js';
import { searchKnowledge } from '../lib/knowledge-search.js';
import { generateResponse, languageInstruction, responseGuardrails } from '../lib/ai.js';
import { detectHumanRequest, resolveEscalation, buildEscalationMessage } from '../lib/escalation.js';

const router = Router();

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
    res.json({
      widgetId: widget.id,
      personality: cfg.personality || {},
      behavior: cfg.behavior || {},
      appearance: cfg.appearance || {},
    });
  } catch (err) {
    console.error('Public config error:', err);
    res.status(500).json({ error: 'Failed to load widget config' });
  }
});

router.post('/:slug/chat', async (req, res) => {
  try {
    const { message, visitorId, context, history, escalate } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const widget = await prisma.widget.findUnique({
      where: { slug: req.params.slug },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const cfg = widget.config || {};
    const aiConfig = cfg.ai || {};
    const personality = cfg.personality || {};
    const escalation = resolveEscalation(aiConfig.escalation || {});
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
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }
    conversationMessages.push({ role: 'user', content: message });

    let aiResult;
    if (escalationMessage) {
      aiResult = { content: escalationMessage, usage: null };
    } else {
      try {
        aiResult = await generateResponse({
          systemPrompt: `${systemPrompt}\n\n${languageInstruction(message)}`,
          messages: conversationMessages,
          temperature: aiConfig.temperature || 0.7,
          maxTokens: aiConfig.maxTokens || 500,
        });
      } catch (aiErr) {
        console.error('AI provider error:', aiErr);
        return res.status(503).json({
          error: 'assistant_unavailable',
          message: 'The assistant is temporarily unavailable. Please try again.',
        });
      }
    }

    const vId = visitorId || randomUUID();

    const allMessages = [
      ...(history || []),
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResult.content, timestamp: new Date().toISOString() },
    ];

    let conversationId;
    try {
      const existingConvo = context?.conversationId
        ? await prisma.conversation.findUnique({ where: { id: context.conversationId } })
        : null;

      if (existingConvo) {
        await prisma.conversation.update({
          where: { id: existingConvo.id },
          data: { messages: allMessages, updatedAt: new Date() },
        });
        conversationId = existingConvo.id;
      } else {
        const convo = await prisma.conversation.create({
          data: {
            widgetId: widget.id,
            visitorId: vId,
            messages: allMessages,
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

    res.json({
      response: aiResult.content,
      conversationId,
      visitorId: vId,
      escalation: { available: escalation.enabled },
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process message' });
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
