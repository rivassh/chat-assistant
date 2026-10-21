const STRINGS = {
  en: {
    online: 'Online',
    placeholder: 'Type a message...',
    error: 'Sorry, something went wrong. Please try again.',
    offline: 'Unable to connect. Please check your connection and try again.',
    openAssistant: 'Open assistant',
    closeChat: 'Close chat',
    sendMessage: 'Send message',
    dismiss: 'Dismiss',
    talkToHuman: 'Talk to a human',
    operatorReply: 'Support team',
    handoffEnded: 'Conversation handed back to the assistant',
  },
  fa: {
    online: 'آنلاین',
    placeholder: 'پیامتان را بنویسید...',
    error: 'متاسفم، مشکلی پیش آمد. دوباره تلاش کنید.',
    offline: 'اتصال برقرار نشد. اتصال اینترنت را بررسی کنید.',
    openAssistant: 'باز کردن دستیار',
    closeChat: 'بستن گفتگو',
    sendMessage: 'ارسال پیام',
    dismiss: 'بستن',
    talkToHuman: 'گفتگو با پشتیبانی انسانی',
    operatorReply: 'تیم پشتیبانی',
    handoffEnded: 'گفتگو به دستیار برگشت',
  },
  ar: {
    online: 'متصل',
    placeholder: 'اكتب رسالتك...',
    error: 'حدث خطأ ما. حاول مرة أخرى.',
    offline: 'تعذر الاتصال. تحقق من اتصالك.',
    openAssistant: 'فتح المساعد',
    closeChat: 'إغلاق المحادثة',
    sendMessage: 'إرسال الرسالة',
    dismiss: 'إغلاق',
    talkToHuman: 'التحدث مع موظف بشري',
    operatorReply: 'فريق الدعم',
    handoffEnded: 'تم إرجاع المحادثة إلى المساعد',
  },
};

const LANG_CACHE_MAX = 2000;
let cachedLang = null;
let cachedAt = 0;

// Lazily evaluated each call so a SPA's Persian/Arabic text is in the DOM by
// the time a string is rendered. The widget mounts on DOMContentLoaded,
// before the host SPA has rendered — a one-shot detection in the constructor
// would always see an empty body and return English.
export function detectUiLang(force) {
  const now = Date.now();
  if (!force && cachedLang && now - cachedAt < LANG_CACHE_MAX) return cachedLang;
  cachedAt = now;

  const html = document.documentElement;
  const htmlLang = (html.lang || '').toLowerCase();
  if (htmlLang.startsWith('fa') || htmlLang.startsWith('pe')) return (cachedLang = 'fa');
  if (htmlLang.startsWith('ar')) return (cachedLang = 'ar');

  // Full visible-page sniff (not the first 800 chars): a JS-rendered page may
  // place Persian/Arabic text anywhere in the document.
  const text = `${document.title || ''} ${document.body?.innerText || ''}`;
  if (/[؀-ۿ]/.test(text)) {
    return (cachedLang = /[یکگ]/.test(text) ? 'fa' : 'ar');
  }

  // RTL direction is a strong hint even without Arabic script on the page.
  const dir = (html.dir || getComputedStyle(html).direction || '').toLowerCase();
  if (dir === 'rtl') return (cachedLang = 'fa');

  return (cachedLang = 'en');
}

export function translator(lang = detectUiLang()) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key) => table[key] || STRINGS.en[key] || key;
}
