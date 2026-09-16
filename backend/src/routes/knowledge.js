import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

async function verifyWidgetOwnership(widgetId, userId) {
  const widget = await prisma.widget.findFirst({
    where: { id: widgetId, userId },
  });
  return widget;
}

router.get('/:widgetId/knowledge', async (req, res) => {
  try {
    const widget = await verifyWidgetOwnership(req.params.widgetId, req.user.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const entries = await prisma.knowledgeEntry.findMany({
      where: { widgetId: req.params.widgetId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ entries });
  } catch (err) {
    console.error('List knowledge error:', err);
    res.status(500).json({ error: 'Failed to list knowledge entries' });
  }
});

router.post('/:widgetId/knowledge', async (req, res) => {
  try {
    const widget = await verifyWidgetOwnership(req.params.widgetId, req.user.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const { title, content, tags, category } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const entry = await prisma.knowledgeEntry.create({
      data: {
        widgetId: req.params.widgetId,
        title,
        content,
        tags: tags || [],
        category: category || null,
      },
    });
    res.status(201).json({ entry });
  } catch (err) {
    console.error('Create knowledge error:', err);
    res.status(500).json({ error: 'Failed to create knowledge entry' });
  }
});

router.put('/:widgetId/knowledge/:id', async (req, res) => {
  try {
    const widget = await verifyWidgetOwnership(req.params.widgetId, req.user.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const existing = await prisma.knowledgeEntry.findFirst({
      where: { id: req.params.id, widgetId: req.params.widgetId },
    });
    if (!existing) return res.status(404).json({ error: 'Knowledge entry not found' });

    const { title, content, tags, category } = req.body;
    const entry = await prisma.knowledgeEntry.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(tags !== undefined && { tags }),
        ...(category !== undefined && { category }),
      },
    });
    res.json({ entry });
  } catch (err) {
    console.error('Update knowledge error:', err);
    res.status(500).json({ error: 'Failed to update knowledge entry' });
  }
});

router.delete('/:widgetId/knowledge/:id', async (req, res) => {
  try {
    const widget = await verifyWidgetOwnership(req.params.widgetId, req.user.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const existing = await prisma.knowledgeEntry.findFirst({
      where: { id: req.params.id, widgetId: req.params.widgetId },
    });
    if (!existing) return res.status(404).json({ error: 'Knowledge entry not found' });

    await prisma.knowledgeEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete knowledge error:', err);
    res.status(500).json({ error: 'Failed to delete knowledge entry' });
  }
});

export default router;
