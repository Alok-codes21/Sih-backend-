import 'dotenv/config';
import { app, initApp, shutdownApp } from './app.js';
import { connectDb, closeDb, getDb } from './config/db.js';
import { connectCache, closeCache } from './config/redis.js';
import { initCronJobs } from './services/cronService.js';
import { initIndexes } from './config/indexes.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 3000;

let server;

const startServer = async () => {
  try {
    await connectDb();
    await initIndexes(getDb());
    await connectCache();
    initApp();
    initCronJobs();
    
    server = app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await shutdownApp();
      await closeDb();
      await closeCache();
      process.exit(0);
    });
    
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
