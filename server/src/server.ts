import Fastify from 'fastify';
import fp from 'fastify-plugin';
import appPlugin, { options as appOptions } from './app.js';
import { loggerOptions } from './plugins/logger.js';

export async function createServer() {
  const server = Fastify({
    logger: loggerOptions,
    trustProxy: true,
  });

  await server.register(fp(appPlugin, { name: 'smex-app' }), appOptions);

  return server;
}

export async function startServer() {
  const server = await createServer();
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'Graceful shutdown initiated');
    try {
      await server.close();
      server.log.info('Server successfully closed all connections. Exiting process.');
      process.exit(0);
    } catch (err) {
      server.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ port, host });
    server.log.info(`Server listening at http://${host}:${port}`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server if directly invoked
const isMain =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith('server.ts') ||
   process.argv[1].endsWith('server.js') ||
   process.argv[1].endsWith('server.mjs'));

if (isMain) {
  void startServer();
}
