exports.up = function (knex) {
  return knex.schema.createTable('requirement_seats', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('requirement_id').notNullable().references('id').inTable('requirements').onDelete('CASCADE');
    t.text('seat_label');
    t.enu('seat_status', ['open', 'interviewing', 'offer', 'bgv', 'closed', 'dropped'])
      .notNullable()
      .defaultTo('open');
    t.timestamp('closed_at');
    t.date('joined_at');
    t.boolean('is_locked').notNullable().defaultTo(false);

    t.index(['requirement_id']);
    t.index(['seat_status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('requirement_seats');
};
