import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiBaseUrl: (process.env.AI_BASE_URL || 'http://mimo-adapter:8000').replace(/\/+$/, ''),
  aiModel: process.env.AI_MODEL || 'mimo',
  aiApiKey: process.env.AI_API_KEY || '',
  corsOrigin: (() => {
    const val = process.env.CORS_ORIGIN || 'https://debug.adlr.ir';
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return val.split(',').map(s => s.trim()).filter(Boolean);
  })(),
};
