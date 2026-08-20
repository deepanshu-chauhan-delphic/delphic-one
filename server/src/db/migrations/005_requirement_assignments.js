exports.up = function (knex) {
  return knex.schema.createTable('requirement_assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('requirement_id').notNullable().references('id').inTable('requirements').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.enu('role_on_req', ['sales', 'recruiter']).notNullable();
    t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('unassigned_at');
    t.uuid('assigned_by').notNullable().references('id').inTable('users');

    t.index(['requirement_id']);
    t.index(['user_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('requirement_assignments');
};
