const bcrypt = require('bcryptjs');

/** @param {import('knex').Knex} knex */
exports.seed = async function (knex) {
  await knex('users').del();

  const password_hash = await bcrypt.hash('Password123!', 10);

  await knex('users').insert([
    { name: 'Admin User', email: 'admin@delphic.local', password_hash, role: 'admin' },
    { name: 'Sales One', email: 'sales1@delphic.local', password_hash, role: 'sales' },
    { name: 'BDA One', email: 'bda1@delphic.local', password_hash, role: 'bda' },
    { name: 'Recruiter One', email: 'recruiter1@delphic.local', password_hash, role: 'recruiter' },
    { name: 'Recruiter Two', email: 'recruiter2@delphic.local', password_hash, role: 'recruiter' },
  ]);
};
