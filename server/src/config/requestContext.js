const { AsyncLocalStorage } = require('async_hooks');

// Per-request store used to attribute latency: the Prisma client (config/db.js)
// accumulates query count + total ms here, and requestLogger reads it back out
// so every http_request line can be split into db_ms vs handler_ms.
const storage = new AsyncLocalStorage();

function runWithContext(seed, fn) {
  const store = { dbMs: 0, dbQueries: 0, ...seed };
  return storage.run(store, () => fn(store));
}

function getContext() {
  return storage.getStore();
}

function recordQuery(durationMs) {
  const store = storage.getStore();
  if (!store) return;
  store.dbMs += durationMs;
  store.dbQueries += 1;
}

module.exports = { runWithContext, getContext, recordQuery };
