exports.up = function (knex) {
  return knex.schema.createTable('submissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('requirement_seat_id').notNullable().references('id').inTable('requirement_seats').onDelete('CASCADE');
    t.uuid('profile_id').notNullable().references('id').inTable('profiles');
    t.enu('stage', [
      'sourced',
      'internal_screening',
      'submitted_to_client',
      'interview_scheduled',
      'interview_result',
      'offer',
      'bgv',
      'closed',
      'backout',
      'rejected',
    ])
      .notNullable()
      .defaultTo('sourced');

    // Commercials
    t.decimal('proposed_rate', 14, 2);
    t.enu('proposed_rate_type', ['monthly', 'hourly', 'annual']);
    t.enu('proposed_rate_currency', ['INR', 'USD', 'AED', 'SAR']).defaultTo('INR');
    t.decimal('vendor_rate', 14, 2);
    t.enu('vendor_rate_type', ['monthly', 'hourly', 'annual']);
    t.enu('vendor_rate_currency', ['INR', 'USD', 'AED', 'SAR']);
    t.decimal('margin', 14, 2);
    t.decimal('margin_percentage', 6, 2);
    t.decimal('final_agreed_rate', 14, 2);
    t.enu('final_agreed_rate_type', ['monthly', 'hourly', 'annual']);

    // Notes & tracking
    t.text('submission_notes');
    t.text('client_feedback');
    t.integer('relevancy_score');

    // Backout/rejection
    t.text('backout_stage');
    t.text('backout_reason');
    t.text('rejection_stage');
    t.text('rejection_reason');

    // Offer & joining
    t.date('offer_date');
    t.decimal('offer_ctc', 14, 2);
    t.enu('offer_ctc_currency', ['INR', 'USD', 'AED', 'SAR']);
    t.date('expected_joining_date');
    t.date('actual_joining_date');

    // BGV
    t.date('bgv_initiated_date');
    t.enu('bgv_status', ['pending', 'in_progress', 'cleared', 'failed']);
    t.date('bgv_completed_date');
    t.text('bgv_notes');

    // System
    t.uuid('submitted_by').notNullable().references('id').inTable('users');
    t.boolean('is_locked').notNullable().defaultTo(false);
    t.timestamps(true, true);

    t.index(['requirement_seat_id']);
    t.index(['profile_id']);
    t.index(['stage']);

    t.check('relevancy_score is null or (relevancy_score between 1 and 10)', [], 'submissions_relevancy_score_check');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('submissions');
};
