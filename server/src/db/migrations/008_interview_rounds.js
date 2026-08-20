exports.up = function (knex) {
  return knex.schema.createTable('interview_rounds', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('submission_id').notNullable().references('id').inTable('submissions').onDelete('CASCADE');
    t.integer('round_number').notNullable();
    t.enu('round_type', ['internal', 'client_l1', 'client_l2', 'client_hr', 'client_final']).notNullable();
    t.text('round_name');
    t.timestamp('scheduled_at');
    t.integer('duration_minutes');
    t.text('interviewer_name');
    t.text('interviewer_email');
    t.text('meeting_link');
    t.enu('result', ['pending', 'pass', 'fail', 'no_show', 'rescheduled']).notNullable().defaultTo('pending');
    t.text('feedback');
    t.integer('rating');
    t.timestamp('completed_at');

    t.index(['submission_id']);
    t.check('rating is null or (rating between 1 and 10)', [], 'interview_rounds_rating_check');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('interview_rounds');
};
