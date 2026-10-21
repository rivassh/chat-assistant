const HUMAN_REQUEST_PATTERNS = [
  // English
  /\bhuman\b/i,
  /\breal person\b/i,
  /\blive (agent|person|support)\b/i,
  /\b(actual|real) (person|agent|representative)\b/i,
  /\b(speak|talk|chat) (to|with) (a |an |my )?(human|person|agent|representative|someone|somebody|manager)\b/i,
  /\b(support (team|agent|representative)|customer service (agent|representative))\b/i,
  /\bescalat(e|ion)\b/i,
  // Persian
  /پشتیبانی\s*انسانی/,
  /اپراتور/,
  /با\s*(یک\s*)?ادمین/,
  /ادمین\s*(صحبت|جواب|پاسخ)/,
  /با\s*(یک\s*)?کارشناس/,
  /کارشناس\s*(صحبت|جواب|پاسخ)/,
  /با\s*(یک\s*)?انسان/,
  /انسان\s*(صحبت|جواب|پاسخ|بگو)/,
  /صحبت\s*(با|کنم با)\s*(یک\s*)?(نفر|آدم|کسی|انسان)/,
  /کسی\s*(جواب|پاسخ)\s*بده/,
  /یک\s*نفر\s*جواب/,
  /با\s*مدیر/,
  /مدیر\s*(صحبت|جواب|پاسخ)/,
];

export function detectHumanRequest(text = '') {
  if (!text || !text.trim()) return false;
  return HUMAN_REQUEST_PATTERNS.some((re) => re.test(text));
}

export function resolveEscalation(escalation = {}) {
  const enabled = escalation?.enabled !== false;
  const message = (escalation?.message || '').trim();
  const contact = (escalation?.contact || '').trim();
  return { enabled, message, contact };
}

export function buildEscalationMessage(escalation, { knowledgeContact = '' } = {}) {
  const { message, contact } = resolveEscalation(escalation);
  const parts = [];
  if (message) parts.push(message);
  if (contact) parts.push(contact);
  else if (knowledgeContact) parts.push(knowledgeContact);
  return parts.join('\n\n');
}
