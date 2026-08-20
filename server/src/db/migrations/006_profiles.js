exports.up = function (knex) {
  return knex.schema.createTable('profiles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Personal
    t.text('name').notNullable();
    t.text('email');
    t.text('phone');
    t.date('date_of_birth');
    t.enu('gender', ['male', 'female', 'other', 'prefer_not_to_say']);
    t.text('current_location');
    t.boolean('willing_to_relocate');
    t.specificType('preferred_locations', 'text[]');

    // Professional
    t.text('current_company');
    t.text('current_designation');
    t.decimal('total_experience_years', 4, 1).notNullable();
    t.decimal('relevant_experience_years', 4, 1);

    // Technical skills
    t.specificType('primary_skills', 'text[]');
    t.specificType('secondary_skills', 'text[]');
    t.specificType('certifications', 'text[]');
    t.specificType('domain_experience', 'text[]');
    t.jsonb('education');

    // Compensation & availability
    t.decimal('current_ctc', 14, 2);
    t.enu('current_ctc_currency', ['INR', 'USD', 'AED', 'SAR']).notNullable().defaultTo('INR');
    t.decimal('expected_ctc', 14, 2);
    t.enu('expected_ctc_currency', ['INR', 'USD', 'AED', 'SAR']).notNullable().defaultTo('INR');
    t.boolean('ctc_negotiable').notNullable().defaultTo(false);
    t.text('ctc_notes');
    t.integer('notice_period_days');
    t.boolean('is_serving_notice').notNullable().defaultTo(false);
    t.date('last_working_day');
    t.date('earliest_join_date');
    t.enu('preferred_work_mode', ['remote', 'onsite', 'hybrid']);

    // Documents & links
    t.text('resume_url');
    t.text('linkedin_url');
    t.text('portfolio_url');
    t.jsonb('other_documents').notNullable().defaultTo('[]');

    // Sourcing & ownership
    t.enu('source', ['internal', 'vendor', 'linkedin']).notNullable();
    t.uuid('vendor_account_id').references('id').inTable('accounts');
    t.text('vendor_profile_id');
    t.uuid('added_by').notNullable().references('id').inTable('users');
    t.text('recruiter_notes');

    // System
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.index(['source']);
    t.index(['added_by']);
    t.index(['is_active']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('profiles');
};
