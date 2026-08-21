const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');

const server = app.listen(env.port, () => {
  const hostApiPort = process.env.HOST_API_PORT || String(env.port);
  const hostClientPort = process.env.HOST_CLIENT_PORT || '8081';
  const hostDbPort = process.env.HOST_DB_PORT || '5434';

  logger.info('server_started', {
    port: env.port,
    env: env.nodeEnv,
    log_level: env.logLevel,
  });

  // One line operators can scan in `docker compose up` logs for host-facing ports.
  logger.info('ports_map', {
    db: `localhost:${hostDbPort}`,
    api: `http://localhost:${hostApiPort}`,
    client: `http://localhost:${hostClientPort}`,
    listen_port: env.port,
  });
});

function shutdown(signal) {
  logger.info('server_shutdown', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { err: reason instanceof Error ? reason : { message: String(reason) } });
});
