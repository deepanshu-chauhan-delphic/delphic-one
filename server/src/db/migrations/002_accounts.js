exports.up = function (knex) {
  return knex.schema.createTable('accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.enu('type', ['client', 'vendor']).notNullable();
    t.text('name').notNullable();
    t.enu('stage', ['lead', 'meeting_scheduled', 'active', 'rescheduled', 'dropped'])
      .notNullable()
      .defaultTo('lead');

    // Company info
    t.text('industry');
    t.enu('company_size', ['startup', 'small', 'mid', 'enterprise']);
    t.text('website');
    t.text('location_city');
    t.text('location_country');
    t.text('gst_or_tax_id');

    // Primary contact
    t.text('poc_name');
    t.text('poc_email');
    t.text('poc_phone');
    t.text('poc_designation');

    // Additional contacts
    t.jsonb('additional_contacts').notNullable().defaultTo('[]');

    // Lead/meeting tracking
    t.text('source');
    t.enu('meeting_mode', ['online', 'offline']);
    t.timestamp('meeting_date');
    t.text('meeting_notes');

    // Vendor-specific
    t.specificType('vendor_specializations', 'text[]');
    t.jsonb('vendor_rate_range');
    t.text('vendor_payment_terms');
    t.text('vendor_agreement_url');

    // Client-specific
    t.enu('client_billing_currency', ['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP']);
    t.text('client_payment_terms');
    t.text('client_agreement_url');

    // Workflow/system
    t.uuid('owner_id').notNullable().references('id').inTable('users');
    t.boolean('is_locked').notNullable().defaultTo(false);
    t.timestamps(true, true);

    t.index(['type', 'stage']);
    t.index(['owner_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('accounts');
};
