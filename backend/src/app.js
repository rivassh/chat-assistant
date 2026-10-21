import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import widgetRoutes from './routes/widgets.js';
import knowledgeRoutes from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import widgetPublicRoutes from './routes/widget-public.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

// One CORS handler for the whole /api surface, so a response can never carry two
// Access-Control-Allow-Origin values (which browsers reject as invalid CORS).
// - /api/public/widgets is embedded on third-party sites: any origin, no credentials.
//   `origin: '*'` must never be combined with `credentials: true`.
// - every other API route stays restricted to the configured allowlist.
app.use(
  '/api',
  cors((req, callback) => {
    const isPublicWidget = req.path.startsWith('/public/widgets');
    callback(null, isPublicWidget ? { origin: '*' } : { origin: config.corsOrigin, credentials: true });
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/widgets', knowledgeRoutes);
app.use('/api/widgets', analyticsRoutes);
app.use('/api/public/widgets', widgetPublicRoutes);

app.get('/chat', (_req, res) => {
  res.sendFile(join(__dirname, '../../dashboard/chat.html'));
});

app.use(errorHandler);
