require('dotenv').config();

/** @type {import('knex').Knex.Config} */
const base = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

module.exports = {
  development: base,
  production: { ...base, pool: { min: 2, max: 10 } },
};
