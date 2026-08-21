const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');

const server = app.listen(env.port, () => {
  logger.info('server_started', { port: env.port, env: env.nodeEnv, log_level: env.logLevel });
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
