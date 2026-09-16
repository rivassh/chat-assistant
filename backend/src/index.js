import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import prisma from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import widgetRoutes from './routes/widgets.js';
import knowledgeRoutes from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import widgetPublicRoutes from './routes/widget-public.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
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

async function start() {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
