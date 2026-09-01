/**
 * GET /reports/clients-without-requirements and /reports/recruiter-vendor-gaps
 * — coverage-gap reports for team members / accounts with no downstream activity.
 */
const {
  app,
  prisma,
  request,
  cleanDatabase,
  createUser,
  loginAs,
  createActiveClientAccount,
  createRequirement,
  createProfile,
  authed,
} = require('./helpers');

let adminToken;
let bda;
let bdaToken;
let bda2;
let recruiter;
let recruiterToken;
let recruiter2;
let sales;
let salesToken;

beforeEach(async () => {
  await cleanDatabase();
  const admin = await createUser({ role: 'admin' });
  bda = await createUser({ role: 'bda' });
  bda2 = await createUser({ role: 'bda' });
  recruiter = await createUser({ role: 'recruiter' });
  recruiter2 = await createUser({ role: 'recruiter' });
  sales = await createUser({ role: 'sales' });
  ({ access_token: adminToken } = await loginAs(admin));
  ({ access_token: bdaToken } = await loginAs(bda));
  ({ access_token: recruiterToken } = await loginAs(recruiter));
  ({ access_token: salesToken } = await loginAs(sales));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /reports/clients-without-requirements', () => {
  test('lists client accounts with zero requirements, with BDA owner + brought by', async () => {
    const idle = await createActiveClientAccount(bda.id);
    const withReq = await createActiveClientAccount(bda.id);
    await createRequirement(salesToken, withReq.id, { title: 'Has a req' });

    const res = await authed(request(app).get('/api/v1/reports/clients-without-requirements'), adminToken);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.client.id);
    expect(ids).toContain(idle.id);
    expect(ids).not.toContain(withReq.id);

    const row = res.body.data.find((r) => r.client.id === idle.id);
    expect(row).toEqual(
      expect.objectContaining({
        bda_owner: expect.objectContaining({ id: bda.id }),
        brought_by: expect.objectContaining({ id: bda.id }),
        sales_owner: null,
        days_idle: expect.any(Number),
      })
    );
  });

  test('a BDA sees only their own idle clients', async () => {
    const mine = await createActiveClientAccount(bda.id);
    const theirs = await createActiveClientAccount(bda2.id);

    const res = await authed(request(app).get('/api/v1/reports/clients-without-requirements'), bdaToken);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.client.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  test('recruiter cannot open it', async () => {
    const res = await authed(request(app).get('/api/v1/reports/clients-without-requirements'), recruiterToken);
    expect(res.status).toBe(403);
  });

  test('xlsx export returns a spreadsheet', async () => {
    await createActiveClientAccount(bda.id);
    const res = await authed(
      request(app).get('/api/v1/reports/export').query({ type: 'xlsx', report: 'clients-without-requirements' }),
      adminToken
    ).buffer();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
  });
});

describe('GET /reports/recruiter-vendor-gaps', () => {
  async function seedVendorProfile(token, { submitted } = {}) {
    const vendor = await prisma.account.create({
      data: {
        type: 'vendor',
        name: `Vendor ${Math.random().toString(36).slice(2, 8)}`,
        stage: 'active',
        owner_id: bda.id,
        origin_owner_id: bda.id,
      },
    });
    const profile = await createProfile(token, { source: 'vendor', vendor_account_id: vendor.id });
    if (submitted) {
      const account = await createActiveClientAccount(bda.id);
      const req = await createRequirement(salesToken, account.id);
      const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
      await authed(request(app).post('/api/v1/submissions'), token).send({
        requirement_seat_id: seats.body.data[0].id,
        profile_id: profile.id,
        proposed_rate: 100,
        proposed_rate_currency: 'INR',
        vendor_rate: 80,
        vendor_rate_currency: 'INR',
      });
    }
    return { vendor, profile };
  }

  test('lists (recruiter, vendor) pairs sourced but never submitted', async () => {
    const gap = await seedVendorProfile(recruiterToken);
    const used = await seedVendorProfile(recruiterToken, { submitted: true });

    const res = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), adminToken);
    expect(res.status).toBe(200);
    const pairs = res.body.data.map((r) => `${r.recruiter.id}:${r.vendor.id}`);
    expect(pairs).toContain(`${recruiter.id}:${gap.vendor.id}`);
    expect(pairs).not.toContain(`${recruiter.id}:${used.vendor.id}`);

    const row = res.body.data.find((r) => r.vendor.id === gap.vendor.id);
    expect(row).toEqual(
      expect.objectContaining({
        recruiter: expect.objectContaining({ id: recruiter.id }),
        profiles_sourced: 1,
        profiles_submitted: 0,
        days_since_sourced: expect.any(Number),
      })
    );
  });

  test('a recruiter sees only their own gaps', async () => {
    const mine = await seedVendorProfile(recruiterToken);
    const { access_token: r2Token } = await loginAs(recruiter2);
    const theirs = await seedVendorProfile(r2Token);

    const res = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), recruiterToken);
    expect(res.status).toBe(200);
    const vendorIds = res.body.data.map((r) => r.vendor.id);
    expect(vendorIds).toContain(mine.vendor.id);
    expect(vendorIds).not.toContain(theirs.vendor.id);
  });

  test('sales cannot open it', async () => {
    const res = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), salesToken);
    expect(res.status).toBe(403);
  });
});
