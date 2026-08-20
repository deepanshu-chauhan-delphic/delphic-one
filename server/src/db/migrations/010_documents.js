exports.up = function (knex) {
  return knex.schema.createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.enu('entity_type', ['account', 'requirement', 'profile', 'submission']).notNullable();
    t.uuid('entity_id').notNullable();
    t.text('label').notNullable();
    t.text('file_url').notNullable();
    t.text('file_type');
    t.integer('file_size_bytes');
    t.uuid('uploaded_by').notNullable().references('id').inTable('users');
    t.timestamp('uploaded_at').notNullable().defaultTo(knex.fn.now());

    t.index(['entity_type', 'entity_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('documents');
};
