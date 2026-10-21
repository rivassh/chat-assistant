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
  },
  fa: {
    online: 'آنلاین',
    placeholder: 'پیامتان را بنویسید...',
    error: 'متأسفم، مشکلی پیش آمد. دوباره تلاش کنید.',
    offline: 'اتصال برقرار نشد. اتصال اینترنت را بررسی کنید.',
    openAssistant: 'باز کردن دستیار',
    closeChat: 'بستن گفتگو',
    sendMessage: 'ارسال پیام',
    dismiss: 'بستن',
    talkToHuman: 'گفتگو با پشتیبانی انسانی',
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
  },
};

export function detectUiLang() {
  const lang = (document.documentElement.lang || '').toLowerCase();
  if (lang.startsWith('fa') || lang.startsWith('pe')) return 'fa';
  if (lang.startsWith('ar')) return 'ar';

  // Fall back to sniffing the page text for Arabic-script characters.
  const text = `${document.title || ''} ${(document.body?.textContent || '').slice(0, 800)}`;
  if (/[؀-ۿ]/.test(text)) {
    return /[یکگ]/.test(text) ? 'fa' : 'ar';
  }
  return 'en';
}

export function translator(lang = detectUiLang()) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key) => table[key] || STRINGS.en[key] || key;
}
