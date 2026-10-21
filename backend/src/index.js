import { app } from './app.js';
import { config } from './config.js';
import prisma from './db.js';

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
