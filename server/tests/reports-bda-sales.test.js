const {
  app,
  prisma,
  request,
  cleanDatabase,
  createUser,
  loginAs,
  createRequirement,
  authed,
  unique,
} = require('./helpers');

let adminToken;
let bda;
let bdaToken;
let sales;
let salesToken;
let otherBda;

const iso = (d) => d.toISOString().slice(0, 10);
const SEP = new Date('2026-09-10T00:00:00Z');

async function mkAccount(over = {}) {
  return prisma.account.create({
    data: {
      type: 'client',
      name: unique('Client '),
      stage: 'lead',
      owner_id: bda.id,
      origin_owner_id: bda.id,
      ...over,
    },
  });
}

beforeEach(async () => {
  await cleanDatabase();
  const admin = await createUser({ role: 'admin' });
  bda = await createUser({ role: 'bda', name: 'Dheeraj BDA' });
  otherBda = await createUser({ role: 'bda', name: 'Other BDA' });
  sales = await createUser({ role: 'sales', name: 'Chahak Sales' });
  ({ access_token: adminToken } = await loginAs(admin));
  ({ access_token: bdaToken } = await loginAs(bda));
  ({ access_token: salesToken } = await loginAs(sales));
});

afterAll(async () => {
  await prisma.$disconnect();
});

const RANGE = { date_from: '2026-09-01', date_to: '2026-09-30' };

async function scheduleMeeting(accountId, token, attendeeIds = []) {
  const res = await authed(request(app).post(`/api/v1/accounts/${accountId}/stage`), token).send({
    to_stage: 'meeting_scheduled',
    meeting_mode: 'online',
    meeting_date: SEP.toISOString(),
    ...(attendeeIds.length ? { meeting_attendee_ids: attendeeIds } : {}),
  });
  expect(res.status).toBe(200);
}

describe('GET /reports/bda-reports', () => {
  test('accounts brought are counted per BDA per day with a type split', async () => {
    await mkAccount({ type: 'client', created_at: SEP });
    await mkAccount({ type: 'vendor', created_at: SEP });
    await mkAccount({ type: null, created_at: SEP });
    await mkAccount({ type: 'client', created_at: SEP, origin_owner_id: otherBda.id });

    const res = await authed(request(app).get('/api/v1/reports/bda-reports').query(RANGE), adminToken);
    expect(res.status).toBe(200);
    const table = res.body.data.tables.find((t) => t.key === 'accounts_created');
    const mine = table.rows.find((r) => r.bda_id === bda.id);
    expect(mine.count).toBe(3);
    expect(mine.by_type).toEqual({ Client: 1, Vendor: 1, Unclassified: 1 });
    expect(table.rows.find((r) => r.bda_id === otherBda.id).count).toBe(1);
  });

  test('meetings scheduled + converted-to-active, per day and rolled up', async () => {
    const converted = await mkAccount();
    const notConverted = await mkAccount();
    await scheduleMeeting(converted.id, bdaToken);
    await scheduleMeeting(notConverted.id, bdaToken);
    const toActive = await authed(request(app).post(`/api/v1/accounts/${converted.id}/stage`), bdaToken).send({
      to_stage: 'active',
    });
    expect(toActive.status).toBe(200);

    const res = await authed(request(app).get('/api/v1/reports/bda-reports').query(RANGE), adminToken);
    const day = res.body.data.tables.find((t) => t.key === 'meetings_scheduled').rows.find((r) => r.bda_id === bda.id);
    expect(day.meetings_scheduled).toBe(2);
    expect(day.converted_to_active).toBe(1);
    const rollup = res.body.data.tables
      .find((t) => t.key === 'meetings_conversion')
      .rows.find((r) => r.bda_id === bda.id);
    expect(rollup).toMatchObject({ meetings_scheduled: 2, converted_to_active: 1 });
  });

  test('requirements from BDA client accounts, detail + count, client-only', async () => {
    const client = await mkAccount({ stage: 'active' });
    const vendor = await mkAccount({ stage: 'active', type: 'vendor' });
    await createRequirement(salesToken, client.id, { title: 'Gen AI Architect' });
    // vendor requirement created directly (the create route blocks non-client accounts)
    await prisma.requirement.create({
      data: {
        account_id: vendor.id,
        title: 'Should not appear',
        req_type: 'recruitment',
        sales_owner_id: sales.id,
        created_at: SEP,
      },
    });

    const res = await authed(request(app).get('/api/v1/reports/bda-reports').query(RANGE), adminToken);
    const detail = res.body.data.tables.find((t) => t.key === 'requirements_brought');
    expect(detail.rows).toHaveLength(1);
    expect(detail.rows[0]).toMatchObject({ client: client.name, requirement: 'Gen AI Architect', bda_id: bda.id });
    expect(detail.rows[0].client_id).toBe(client.id);
    const count = res.body.data.tables.find((t) => t.key === 'requirements_brought_counts').rows[0];
    expect(count.count).toBe(1);
    expect(count.clients[client.name]).toBe(1);
  });

  test('a BDA only sees their own rows', async () => {
    await mkAccount({ created_at: SEP });
    await mkAccount({ created_at: SEP, origin_owner_id: otherBda.id });

    const res = await authed(request(app).get('/api/v1/reports/bda-reports').query(RANGE), bdaToken);
    expect(res.status).toBe(200);
    const rows = res.body.data.tables.find((t) => t.key === 'accounts_created').rows;
    expect(rows.every((r) => r.bda_id === bda.id)).toBe(true);
  });
});

describe('GET /reports/sales-reports', () => {
  test('requirements created per Sales POC per day, with client hover map', async () => {
    const c1 = await mkAccount({ stage: 'active', name: 'Acme Co' });
    const c2 = await mkAccount({ stage: 'active', name: 'Beta Co' });
    await createRequirement(salesToken, c1.id);
    await createRequirement(salesToken, c1.id);
    await createRequirement(salesToken, c2.id);

    const res = await authed(request(app).get('/api/v1/reports/sales-reports').query(RANGE), adminToken);
    expect(res.status).toBe(200);
    const row = res.body.data.tables.find((t) => t.key === 'requirements_created').rows.find((r) => r.sales_poc_id === sales.id);
    expect(row.count).toBe(3);
    expect(row.clients).toEqual({ 'Acme Co': 2, 'Beta Co': 1 });
  });

  test('meetings attended counts the sales user as a listed attendee', async () => {
    const acct = await mkAccount();
    await scheduleMeeting(acct.id, bdaToken, [sales.id]);

    const res = await authed(request(app).get('/api/v1/reports/sales-reports').query(RANGE), salesToken);
    const row = res.body.data.tables.find((t) => t.key === 'meetings_attended').rows.find((r) => r.sales_poc_id === sales.id);
    expect(row.count).toBe(1);
    expect(row.date).toBe(iso(SEP));
  });

  test('IST day bucketing: a same-day custom range agrees with a wider range at the day boundary', async () => {
    // 2026-09-09T19:30Z == 2026-09-10 01:00 IST -> IST day is Sep 10, UTC day is Sep 9.
    const acct = await mkAccount();
    await prisma.account.update({
      where: { id: acct.id },
      data: {
        stage: 'meeting_scheduled',
        meeting_mode: 'online',
        meeting_date: new Date('2026-09-09T19:30:00.000Z'),
        meeting_attendees: { create: { user_id: sales.id } },
      },
    });

    const wide = await authed(
      request(app).get('/api/v1/reports/sales-reports').query({ date_from: '2026-09-01', date_to: '2026-09-30' }),
      salesToken
    );
    const sameDay = await authed(
      request(app).get('/api/v1/reports/sales-reports').query({ date_from: '2026-09-10', date_to: '2026-09-10' }),
      salesToken
    );
    const sep = (r, day) =>
      r.body.data.tables
        .find((t) => t.key === 'meetings_attended')
        .rows.filter((x) => x.date === day)
        .reduce((s, x) => s + x.count, 0);
    expect(sep(wide, '2026-09-10')).toBe(1); // bucketed on the IST day
    expect(sep(wide, '2026-09-09')).toBe(0); // not the UTC day
    expect(sep(sameDay, '2026-09-10')).toBe(1); // same-day IST range still catches it
  });

  test('a sales user only sees their own rows', async () => {
    const c1 = await mkAccount({ stage: 'active' });
    await createRequirement(salesToken, c1.id);
    // a requirement owned by someone else
    const otherSales = await createUser({ role: 'sales' });
    const { access_token: otherToken } = await loginAs(otherSales);
    const c2 = await mkAccount({ stage: 'active' });
    await createRequirement(otherToken, c2.id);

    const res = await authed(request(app).get('/api/v1/reports/sales-reports').query(RANGE), salesToken);
    const rows = res.body.data.tables.find((t) => t.key === 'requirements_created').rows;
    expect(rows.every((r) => r.sales_poc_id === sales.id)).toBe(true);
  });
});

describe('GET /reports/joinings — by sales requirement tab', () => {
  test('joinings are grouped by the requirement sales owner', async () => {
    const client = await mkAccount({ stage: 'active' });
    const req = await createRequirement(salesToken, client.id);
    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    const seatId = seats.body.data[0].id;
    const profile = await prisma.profile.create({
      data: { name: unique('Cand '), total_experience_years: 4, primary_skills: ['Node.js'], source: 'direct', added_by: sales.id },
    });
    await prisma.submission.create({
      data: {
        requirement_seat_id: seatId,
        profile_id: profile.id,
        submitted_by: sales.id,
        stage: 'closed',
        actual_joining_date: SEP,
      },
    });

    const res = await authed(request(app).get('/api/v1/reports/joinings').query(RANGE), adminToken);
    expect(res.status).toBe(200);
    const table = res.body.data.tables.find((t) => t.key === 'by_sales_poc');
    expect(table).toBeTruthy();
    const row = table.rows.find((r) => r.sales_poc_id === sales.id);
    expect(row.joinings).toBe(1);
    expect(row.month).toBe('Sep 2026');
  });
});
