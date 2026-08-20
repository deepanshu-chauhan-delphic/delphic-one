exports.up = function (knex) {
  return knex.schema.createTable('stage_history', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.enu('entity_type', ['account', 'requirement', 'seat', 'submission']).notNullable();
    t.uuid('entity_id').notNullable();
    t.text('from_stage');
    t.text('to_stage').notNullable();
    t.uuid('changed_by').notNullable().references('id').inTable('users');
    t.text('reason');
    t.timestamp('changed_at').notNullable().defaultTo(knex.fn.now());

    t.index(['entity_type', 'entity_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('stage_history');
};
