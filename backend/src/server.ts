import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[server] Kickstead API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Log anything that escapes request handling. An uncaught exception leaves the process in an
// unknown state, so exit and let the container restart policy bring it back.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled promise rejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception, exiting', err);
  process.exit(1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
