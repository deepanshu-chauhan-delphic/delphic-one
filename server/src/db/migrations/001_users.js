exports.up = function (knex) {
  return knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable();
    t.text('email').notNullable().unique();
    t.text('password_hash').notNullable();
    t.enu('role', ['bda', 'sales', 'recruiter', 'admin']).notNullable();
    t.text('phone');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
