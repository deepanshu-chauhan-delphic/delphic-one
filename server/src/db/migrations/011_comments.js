exports.up = function (knex) {
  return knex.schema.createTable('comments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.enu('entity_type', ['account', 'requirement', 'submission']).notNullable();
    t.uuid('entity_id').notNullable();
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.text('body').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['entity_type', 'entity_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('comments');
};
