import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@adlr.ir';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin1234';

const DEFAULT_CONFIG = {
  personality: {
    name: 'دستیار',
    tone: 'friendly',
    avatarUrl: '',
    welcomeMessage: 'سلام! من دستیار این سایت هستم. چطور می‌تونم کمکتون کنم؟',
  },
  behavior: {
    proactiveTriggers: [
      { type: 'time_on_page', seconds: 45, message: 'کمکی لازم دارید؟ من اینجام تا کمکتون کنم.' },
      { type: 'scroll_depth', percent: 75, message: 'دارید ته صفحه می‌روید — کمکی لازم دارید؟' },
    ],
    pageRules: [
      { urlPattern: '/pricing', message: 'می‌خواهید پلن‌های ما را با هم بررسی کنیم؟' },
      { urlPattern: '/checkout', message: 'برای خرید کمک لازم دارید؟' },
      { urlPattern: '/docs', message: 'دنبال مستندات خاصی هستید؟' },
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

const KNOWLEDGE = [
  {
    title: 'تماس و پشتیبانی',
    content: 'برای تماس با تیم پشتیبانی از فرم تماس سایت استفاده کنید یا یک ایمیل به آدرس درج‌شده در پاورقی بفرستید. پشتیبانی در یک روز کاری پاسخ می‌دهد.',
    tags: ['contact', 'support', 'email'],
    category: 'general',
  },
  {
    title: 'ساعات کاری',
    content: 'سایت از شنبه تا چهارشنبه از ۹ صبح تا ۱۷ عصر به وقت تهران پاسخگویی دارد. در تعطیلات رسمی ایران و روزهای جمعه بسته است.',
    tags: ['hours', 'open', 'schedule'],
    category: 'general',
  },
  {
    title: 'خدمات سایت',
    content: 'شرکت در زمینه مشاوره نرم‌افزار، توسعه وب اختصاصی و قراردادهای پشتیبانی فنی بلندمدت برای کسب‌وکارهای در حال رشد فعالیت می‌کند.',
    tags: ['services', 'consulting', 'development'],
    category: 'services',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: passwordHash, name: 'Site Assistant Admin' },
    create: {
      email: ADMIN_EMAIL,
      password: passwordHash,
      name: 'Site Assistant Admin',
    },
  });
  console.log(`[seed] user ${admin.email} (${admin.id})`);

  const widget = await prisma.widget.upsert({
    where: { slug: 'site-assistant-widget' },
    update: { userId: admin.id, config: DEFAULT_CONFIG },
    create: {
      userId: admin.id,
      name: 'site-assistant-widget',
      slug: 'site-assistant-widget',
      config: DEFAULT_CONFIG,
    },
  });
  console.log(`[seed] widget ${widget.slug} (${widget.id})`);

  for (const k of KNOWLEDGE) {
    const existing = await prisma.knowledgeEntry.findFirst({
      where: { widgetId: widget.id, title: k.title },
    });
    if (existing) {
      await prisma.knowledgeEntry.update({
        where: { id: existing.id },
        data: { content: k.content, tags: k.tags, category: k.category },
      });
    } else {
      await prisma.knowledgeEntry.create({
        data: { widgetId: widget.id, ...k },
      });
    }
    console.log(`[seed] knowledge "${k.title}"`);
  }

  const counts = {
    users: await prisma.user.count(),
    widgets: await prisma.widget.count(),
    knowledge: await prisma.knowledgeEntry.count(),
    conversations: await prisma.conversation.count(),
    analytics: await prisma.analyticsEvent.count(),
  };
  console.log('[seed] counts', counts);
}

main()
  .catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
