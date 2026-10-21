import { config } from '../config.js';

const REQUEST_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '60000', 10);

// Detects the script of the user message so the model can be told to answer
// in the same language instead of drifting to the prompt's language.
export function detectLanguage(text = '') {
  if (/[؀-ۿݐ-ݿ]/.test(text)) {
    return /[یکگ]/.test(text) ? 'fa' : 'ar';
  }
  if (/[Ѐ-ӿ]/.test(text)) return 'ru';
  if (/[一-鿿]/.test(text)) return 'zh';
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[가-힯]/.test(text)) return 'ko';
  return 'en';
}

const LANGUAGE_NAMES = {
  fa: 'Persian (Farsi)',
  ar: 'Arabic',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  en: 'English',
};

export function languageInstruction(text = '') {
  const lang = detectLanguage(text);
  return `Always answer in ${LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.en}, using the exact script the user wrote in.`;
}

// The upstream model is a reasoning/coding model and will happily dump its
// "thinking process" into the chat bubble unless told not to.
export function responseGuardrails() {
  return [
    'Reply with ONLY the final answer for the user.',
    'Never reveal, show, or describe your reasoning, analysis, plan, chain of thought, or step-by-step thinking. Do not write headings like "Thinking process" or "Analysis".',
    'Never describe what you are about to do; just do it and give the result.',
    'If the question cannot be answered from the provided context, or it needs a person (account access, a private request, a decision, a complaint, or anything you cannot resolve yourself), say that a human colleague will take it over and share the contact details from the knowledge base.',
  ].join('\n');
}

// A reply that opens with one of these is model scaffolding, not an answer.
const REASONING_OPENERS = [
  /^(here'?s|here is)\s+(my|the|a)?\s*(thinking|reasoning|analysis|thought process)/i,
  /^let me (think|analyze|reason|break down)/i,
  /^\**\s*(thinking|reasoning|analysis)\s*process\b/i,
  /^(first|step 1)\**\s*[:.]?\s*\**analyz/i,
];

// A reply that is only an upstream safety classification (e.g.
// "User Safety: safe") is not an answer either — the model echoes its
// internal verdict instead of replying.
const SAFETY_TAG_RE = /^(User Safety|Context Safety)/i;

// Internal planning that leaked into the reply. Only inspected near the top
// of the reply, because that is where the scaffolding lives.
const PLANNING_MARKERS = [
  /^\s*\d+\.\s*\**analyz/i,
  /\*\*\s*analyz/i,
  /the user'?s input/i,
  /\bwe need (answer|respond|reply|to answer|to respond)\b/i,
  /\bthe user (says|wants|is asking|asks)\b/i,
  /\buser'?s (input|question|request)\b/i,
  /^\s*\*\*\s*(thinking|reasoning|analysis)/i,
  // Persian third-person narration of the request.
  /^\s*کاربر\s*(درخواست|می‌پرسد|می‌گوید|پرسیده|گفته|نوشته)/,
  /^\s*درخواست کاربر/,
  /بر اساس (درخواست|سؤال) کاربر/,
];

const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

// The upstream reports finish_reason "stop" even when it cut the reply
// mid-word, so truncation is detected by the shape of the reply itself: a
// long reply that ends on a letter/digit without any terminator.
const TERMINATOR_RE = /[.!?؟۔…؛:)\]}»"']$/;

export function isTruncated(content = '') {
  const text = String(content).trim();
  if (text.length < 60) return false;
  if (TERMINATOR_RE.test(text)) return false;
  return /[\p{L}\p{N}]$/u.test(text);
}

// A reply is defective when it is the model thinking out loud instead of
// answering: scaffolding, a safety verdict, or a reply written in a different
// script than the question.
export function isDefectiveAnswer(content = '', questionText = '') {
  const text = String(content).trim();
  if (!text) return true;
  if (SAFETY_TAG_RE.test(text)) return true;
  if (REASONING_OPENERS.some((re) => re.test(text))) return true;
  if (PLANNING_MARKERS.some((re) => re.test(text.slice(0, 400)))) return true;

  const qLang = detectLanguage(questionText);
  if ((qLang === 'fa' || qLang === 'ar') && !ARABIC_SCRIPT_RE.test(text)) {
    return true;
  }
  return false;
}

function extractFinalAnswer(content = '') {
  const text = String(content);
  for (const marker of [
    /^\**\s*final (answer|response|reply)\s*\**\s*:/i,
    /^\**\s*(the )?(answer|response|reply)\s*(to the user\s*)?\**\s*:/i,
  ]) {
    const match = text.match(marker);
    if (!match) continue;
    const rest = text.slice(match.index + match[0].length).replace(/^\s*[-*]\s*/, '').trim();
    if (rest) return rest;
  }
  return '';
}

// Attempt 2: keep the prompt, add an explicit "answer only" reminder.
const STRICT_RETRY_PROMPT = [
  'IMPORTANT: Reply with the reply text for the user and nothing else.',
  'Do not output analysis, reasoning, plans, headings, bullet breakdowns of your process, or commentary about what you are doing.',
  'Begin immediately with the words of your reply.',
].join(' ');

// Attempt 3: re-ask with a terser brief — the model plans less when the
// expected shape of the reply is spelled out.
const TERSE_RETRY_PROMPT = [
  'Answer the user now, in their language, in three sentences or fewer.',
  'Output the answer text only. No analysis, no plan, no restating the question, no preamble.',
].join(' ');

async function callProvider({ systemPrompt, messages, temperature, maxTokens }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (config.aiApiKey) headers.Authorization = `Bearer ${config.aiApiKey}`;

    const resp = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.aiModel,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 200,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`AI provider responded ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || !String(content).trim()) {
      throw new Error('AI provider returned an empty response');
    }

    return {
      content: String(content).trim(),
      usage: data?.usage || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackReply(lang) {
  if (lang === 'fa') {
    return 'متأسفانه نتوانستم به این سؤال پاسخ دهم. لطفاً دوباره تلاش کنید یا با پشتیبانی سایت تماس بگیرید.';
  }
  if (lang === 'ar') {
    return 'للأسف لم أتمكن من الإجابة على هذا السؤال. حاول مرة أخرى أو اتصل بالدعم عبر موقع الويب.';
  }
  return 'I could not produce a useful reply right now. Please try again, or contact support.';
}

export async function generateResponse({ systemPrompt, messages, temperature, maxTokens }) {
  const question = messages.at(-1)?.content || '';
  const budget = maxTokens ?? 500;
  const attempts = [
    { systemPrompt, temperature, maxTokens: budget },
    { systemPrompt: `${systemPrompt}\n\n${STRICT_RETRY_PROMPT}`, temperature, maxTokens: Math.min(budget * 2, 2000) },
    { systemPrompt: `${systemPrompt}\n\n${TERSE_RETRY_PROMPT}`, temperature: 0.5, maxTokens: Math.min(budget * 2, 2000) },
  ];

  // A reply that is a real answer but got cut short is still worth showing.
  let best = null;
  for (const attempt of attempts) {
    const result = await callProvider({ ...attempt, messages });

    if (!isDefectiveAnswer(result.content, question)) {
      if (!isTruncated(result.content)) return result;
      if (!best) best = result;
    }

    const extracted = extractFinalAnswer(result.content);
    if (extracted && !isDefectiveAnswer(extracted, question)) {
      return { ...result, content: extracted };
    }
  }

  if (best) return best;
  return { content: fallbackReply(detectLanguage(question)) };
}
