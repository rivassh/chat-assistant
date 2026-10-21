import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

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
