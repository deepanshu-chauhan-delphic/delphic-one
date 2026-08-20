exports.up = function (knex) {
  return knex.schema.createTable('requirements', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('account_id').notNullable().references('id').inTable('accounts');
    t.text('title').notNullable();
    t.enu('req_type', ['project', 'developer']).notNullable();
    t.enu('status', ['open', 'in_progress', 'on_hold', 'closed', 'dropped'])
      .notNullable()
      .defaultTo('open');

    // Role/position details
    t.text('description');
    t.text('jd_document_url');
    t.text('designation');
    t.text('department');
    t.integer('seats_total').notNullable().defaultTo(1);

    // Technical requirements
    t.specificType('primary_tech_stack', 'text[]');
    t.specificType('secondary_tech_stack', 'text[]');
    t.text('domain_experience');
    t.decimal('experience_min', 4, 1);
    t.decimal('experience_max', 4, 1);
    t.specificType('certifications_required', 'text[]');

    // Work arrangement
    t.enu('work_mode', ['remote', 'onsite', 'hybrid']);
    t.text('work_location');
    t.text('time_zone_preference');
    t.enu('engagement_type', ['full_time', 'part_time', 'contract']);
    t.integer('contract_duration_months');
    t.date('start_date_target');
    t.integer('notice_period_max_days');

    // Budget
    t.decimal('budget_min', 14, 2);
    t.decimal('budget_max', 14, 2);
    t.enu('budget_currency', ['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP']).notNullable().defaultTo('INR');
    t.enu('budget_type', ['monthly', 'hourly', 'annual', 'fixed_project']);
    t.text('billing_notes');

    // Priority & SLA
    t.enu('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium');
    t.integer('sla_days');

    // Workflow/system
    t.uuid('sales_owner_id').notNullable().references('id').inTable('users');
    t.boolean('is_locked').notNullable().defaultTo(false);
    t.timestamp('closed_at');
    t.timestamps(true, true);

    t.index(['account_id']);
    t.index(['status', 'priority']);
    t.index(['sales_owner_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('requirements');
};
