import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../db.js';
import { searchKnowledge } from '../lib/knowledge-search.js';
import { generateResponse } from '../lib/ai.js';

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
    const { message, visitorId, context, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const widget = await prisma.widget.findUnique({
      where: { slug: req.params.slug },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const cfg = widget.config || {};
    const aiConfig = cfg.ai || {};
    const personality = cfg.personality || {};

    const knowledgeEntries = await prisma.knowledgeEntry.findMany({
      where: { widgetId: widget.id },
    });

    const relevantKnowledge = searchKnowledge(message, knowledgeEntries, 3);
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
      `\n\nYou are "${personality.name || 'Assistant'}" with a ${personality.tone || 'friendly'} tone.`;

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

    const aiResult = await generateResponse({
      systemPrompt,
      messages: conversationMessages,
      temperature: aiConfig.temperature || 0.7,
      maxTokens: aiConfig.maxTokens || 200,
    });

    const vId = visitorId || randomUUID();

    const allMessages = [
      ...(history || []),
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResult.content, timestamp: new Date().toISOString() },
    ];

    const existingConvo = context?.conversationId
      ? await prisma.conversation.findUnique({ where: { id: context.conversationId } })
      : null;

    let conversationId;
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

    res.json({
      response: aiResult.content,
      conversationId,
      visitorId: vId,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
