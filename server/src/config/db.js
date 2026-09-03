const { PrismaClient } = require('@prisma/client');
const env = require('./env');
const { recordQuery } = require('./requestContext');

const log = env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'];

const base = new PrismaClient({ log });

// Time every Prisma operation and attribute it to the in-flight request
// (requestContext.js) so requestLogger can split duration into db vs handler.
// A client extension runs inside the caller's async context, so AsyncLocalStorage
// still resolves here (a $on('query') listener would not).
const prisma = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      const start = process.hrtime.bigint();
      try {
        return await query(args);
      } finally {
        recordQuery(Number(process.hrtime.bigint() - start) / 1e6);
      }
    },
  },
});

module.exports = prisma;
