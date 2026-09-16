import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/:widgetId/analytics', authMiddleware, async (req, res) => {
  try {
    const widget = await prisma.widget.findFirst({
      where: { id: req.params.widgetId, userId: req.user.id },
    });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const { period = '7d' } = req.query;
    const now = new Date();
    let startDate;
    switch (period) {
      case '24h': startDate = new Date(now - 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    const [totalConversations, uniqueVisitors, eventsByType, recentConversations] = await Promise.all([
      prisma.conversation.count({
        where: { widgetId: req.params.widgetId, createdAt: { gte: startDate } },
      }),
      prisma.conversation.findMany({
        where: { widgetId: req.params.widgetId, createdAt: { gte: startDate } },
        select: { visitorId: true },
        distinct: ['visitorId'],
      }).then(r => r.length),
      prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { widgetId: req.params.widgetId, createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.conversation.findMany({
        where: { widgetId: req.params.widgetId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, visitorId: true, pageUrl: true, createdAt: true, messages: true },
      }),
    ]);

    const events = {};
    eventsByType.forEach(e => { events[e.eventType] = e._count; });

    res.json({
      period,
      totalConversations,
      uniqueVisitors,
      events,
      recentConversations,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.post('/:widgetId/events', async (req, res) => {
  try {
    const { eventType, metadata, visitorId, pageUrl } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType is required' });

    const widget = await prisma.widget.findFirst({ where: { id: req.params.widgetId } });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    await prisma.analyticsEvent.create({
      data: {
        widgetId: req.params.widgetId,
        eventType,
        metadata: metadata || {},
        visitorId: visitorId || null,
        pageUrl: pageUrl || null,
      },
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Track event error:', err);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

export default router;
