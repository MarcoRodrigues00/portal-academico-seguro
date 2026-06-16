import app from './app.js';
import { env } from './config/env.js';
import prisma from './lib/prisma.js';
import logger from './lib/logger.js';

// Capturar falhas não tratadas antes de qualquer operação assíncrona
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

function shutdown(): void {
  logger.info('Shutting down...');

  // Forçar saída após 10s se o graceful shutdown travar
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref(); // Não manter o processo vivo só por este timer

  // Encerrar conexões keep-alive imediatamente e parar de aceitar novas
  server.closeAllConnections();
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => {
        clearTimeout(forceExit);
        logger.info('Server closed');
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
