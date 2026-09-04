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
  test('lists client accounts with zero requirements, with Sales POC (owner) + Brought by', async () => {
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
        sales_poc: expect.objectContaining({ id: bda.id }),
        brought_by: expect.objectContaining({ id: bda.id }),
        days_idle: expect.any(Number),
      })
    );
    expect(row).not.toHaveProperty('sales_owner');
  });

  test('filters by stage', async () => {
    const activeClient = await createActiveClientAccount(bda.id);
    const leadClient = await prisma.account.create({
      data: {
        type: 'client',
        name: `Lead ${Math.random().toString(36).slice(2, 8)}`,
        stage: 'lead',
        owner_id: bda.id,
        origin_owner_id: bda.id,
      },
    });

    const activeRes = await authed(
      request(app).get('/api/v1/reports/clients-without-requirements').query({ stage: 'active' }),
      adminToken
    );
    expect(activeRes.status).toBe(200);
    const activeIds = activeRes.body.data.map((r) => r.client.id);
    expect(activeIds).toContain(activeClient.id);
    expect(activeIds).not.toContain(leadClient.id);

    const leadRes = await authed(
      request(app).get('/api/v1/reports/clients-without-requirements').query({ stage: 'lead' }),
      adminToken
    );
    expect(leadRes.status).toBe(200);
    const leadIds = leadRes.body.data.map((r) => r.client.id);
    expect(leadIds).toContain(leadClient.id);
    expect(leadIds).not.toContain(activeClient.id);
  });

  test('filters by created-date range', async () => {
    const recent = await createActiveClientAccount(bda.id);
    const old = await createActiveClientAccount(bda.id);
    await prisma.account.update({ where: { id: old.id }, data: { created_at: new Date('2020-01-01') } });

    const res = await authed(
      request(app)
        .get('/api/v1/reports/clients-without-requirements')
        .query({ stage: 'active', date_from: '2024-01-01' }),
      adminToken
    );
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.client.id);
    expect(ids).toContain(recent.id);
    expect(ids).not.toContain(old.id);
  });

  test('includes not-yet-classified (type IS NULL) lead accounts', async () => {
    // A real lead is created with no type; it only becomes type=client on classification.
    const unclassifiedLead = await prisma.account.create({
      data: {
        type: null,
        name: `Unclassified ${Math.random().toString(36).slice(2, 8)}`,
        stage: 'lead',
        owner_id: bda.id,
        origin_owner_id: bda.id,
      },
    });

    const res = await authed(
      request(app).get('/api/v1/reports/clients-without-requirements').query({ stage: 'lead' }),
      adminToken
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.client.id)).toContain(unclassifiedLead.id);
  });

  test('buckets: with_requirements = has an open/in-progress/hold req; without = never had any', async () => {
    const idle = await createActiveClientAccount(bda.id);

    const withOpenReq = await createActiveClientAccount(bda.id);
    await createRequirement(salesToken, withOpenReq.id, { title: 'Open req' });

    const onlyHold = await createActiveClientAccount(bda.id);
    const holdReq = await createRequirement(salesToken, onlyHold.id, { title: 'Hold req' });
    await prisma.requirement.update({ where: { id: holdReq.id }, data: { status: 'on_hold' } });

    // Only a closed requirement — worked in the past, nothing open now.
    const onlyClosed = await createActiveClientAccount(bda.id);
    const closedReq = await createRequirement(salesToken, onlyClosed.id, { title: 'Closed req' });
    await prisma.requirement.update({ where: { id: closedReq.id }, data: { status: 'closed' } });

    const get = (bucket) =>
      authed(
        request(app).get('/api/v1/reports/clients-without-requirements').query({ stage: 'active', bucket }),
        adminToken
      );

    const allIds = (await get('all')).body.data.map((r) => r.client.id);
    const withIds = (await get('with_requirements')).body.data.map((r) => r.client.id);
    const withoutIds = (await get('without_active_requirements')).body.data.map((r) => r.client.id);

    // "Has requirements" = at least one open / in_progress / on_hold req.
    expect(withIds).toEqual(expect.arrayContaining([withOpenReq.id, onlyHold.id]));
    expect(withIds).not.toContain(idle.id);
    expect(withIds).not.toContain(onlyClosed.id);

    // "No requirements" = never had one at all.
    expect(withoutIds).toContain(idle.id);
    expect(withoutIds).not.toContain(onlyHold.id);
    expect(withoutIds).not.toContain(withOpenReq.id);
    expect(withoutIds).not.toContain(onlyClosed.id);

    // Buckets are disjoint; `all` is the superset (closed-only sits in neither).
    expect(allIds).toEqual(expect.arrayContaining([idle.id, withOpenReq.id, onlyHold.id, onlyClosed.id]));
    expect(withIds.filter((id) => withoutIds.includes(id))).toEqual([]);
  });

  test('filters by Brought by (origin_owner_id)', async () => {
    const mine = await createActiveClientAccount(bda.id);
    const other = await createActiveClientAccount(bda2.id);

    const res = await authed(
      request(app).get('/api/v1/reports/clients-without-requirements').query({ origin_owner_id: bda.id }),
      adminToken
    );
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.client.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(other.id);
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

  async function createBareVendor(ownerId = bda.id) {
    return prisma.account.create({
      data: {
        type: 'vendor',
        name: `Vendor ${Math.random().toString(36).slice(2, 8)}`,
        stage: 'active',
        owner_id: ownerId,
        origin_owner_id: ownerId,
      },
    });
  }

  test('lists vendor accounts whose sourced profiles were never submitted', async () => {
    const gap = await seedVendorProfile(recruiterToken);
    const used = await seedVendorProfile(recruiterToken, { submitted: true });

    const res = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), adminToken);
    expect(res.status).toBe(200);
    const vendorIds = res.body.data.map((r) => r.vendor.id);
    expect(vendorIds).toContain(gap.vendor.id);
    expect(vendorIds).not.toContain(used.vendor.id);

    const row = res.body.data.find((r) => r.vendor.id === gap.vendor.id);
    expect(row).toEqual(
      expect.objectContaining({
        our_poc: expect.objectContaining({ id: bda.id }),
        brought_by: expect.objectContaining({ id: bda.id }),
        recruiters: expect.arrayContaining([expect.objectContaining({ id: recruiter.id })]),
        profiles_sourced: 1,
        profiles_submitted: 0,
        days_since_sourced: expect.any(Number),
      })
    );
  });

  test('recruiter_id filter still excludes a vendor that ANY recruiter got submitted', async () => {
    // recruiter1 sources an un-submitted profile from the vendor…
    const vendor = await createBareVendor();
    await createProfile(recruiterToken, { source: 'vendor', vendor_account_id: vendor.id });
    // …recruiter2 sources another profile from the SAME vendor and it IS submitted.
    const { access_token: r2Token } = await loginAs(recruiter2);
    const p2 = await createProfile(r2Token, { source: 'vendor', vendor_account_id: vendor.id });
    const account = await createActiveClientAccount(bda.id);
    const req = await createRequirement(salesToken, account.id);
    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    await authed(request(app).post('/api/v1/submissions'), r2Token).send({
      requirement_seat_id: seats.body.data[0].id,
      profile_id: p2.id,
      proposed_rate: 100,
      proposed_rate_currency: 'INR',
      vendor_rate: 80,
      vendor_rate_currency: 'INR',
    });

    const res = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ recruiter_id: recruiter.id }),
      adminToken
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.vendor.id)).not.toContain(vendor.id);
  });

  test('includes a vendor with no sourced profiles at all (admin view)', async () => {
    const bare = await createBareVendor();

    const res = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), adminToken);
    expect(res.status).toBe(200);
    const row = res.body.data.find((r) => r.vendor.id === bare.id);
    expect(row).toEqual(
      expect.objectContaining({
        profiles_sourced: 0,
        recruiters: [],
        last_sourced_at: null,
        days_since_sourced: null,
      })
    );
  });

  test('counts profiles linked to an account that is not classified type=vendor', async () => {
    // Prod case: the "vendor" account was added but never classified, so type is
    // null (or it is not in the active stage). A profile still points at it.
    const unclassified = await prisma.account.create({
      data: { type: null, name: `Unclassified ${Math.random().toString(36).slice(2, 8)}`, stage: 'lead', owner_id: bda.id, origin_owner_id: bda.id },
    });
    await createProfile(recruiterToken, { source: 'vendor', vendor_account_id: unclassified.id });

    const res = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), adminToken);
    expect(res.status).toBe(200);
    const row = res.body.data.find((r) => r.vendor.id === unclassified.id);
    expect(row).toBeTruthy();
    expect(row.profiles_sourced).toBe(1);
    expect(row.recruiters).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: recruiter.id })])
    );
  });

  test('vendor_activity splits sourced (active) vs never-sourced (inactive)', async () => {
    const sourced = await seedVendorProfile(recruiterToken); // 1 profile, not submitted
    const bare = await createBareVendor();                    // nothing sourced

    const activeRes = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ vendor_activity: 'active' }),
      adminToken
    );
    expect(activeRes.status).toBe(200);
    const activeIds = activeRes.body.data.map((r) => r.vendor.id);
    expect(activeIds).toContain(sourced.vendor.id);
    expect(activeIds).not.toContain(bare.id);
    expect(activeRes.body.data.every((r) => r.profiles_sourced > 0)).toBe(true);

    const inactiveRes = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ vendor_activity: 'inactive' }),
      adminToken
    );
    expect(inactiveRes.status).toBe(200);
    const inactiveIds = inactiveRes.body.data.map((r) => r.vendor.id);
    expect(inactiveIds).toContain(bare.id);
    expect(inactiveIds).not.toContain(sourced.vendor.id);
    expect(inactiveRes.body.data.every((r) => r.profiles_sourced === 0)).toBe(true);
  });

  test('vendor_activity=active still lists a vendor whose sourced profile WAS submitted', async () => {
    const used = await seedVendorProfile(recruiterToken, { submitted: true });

    // Legacy (no toggle) drops it — it is not a "gap".
    const legacy = await authed(request(app).get('/api/v1/reports/recruiter-vendor-gaps'), adminToken);
    expect(legacy.body.data.map((r) => r.vendor.id)).not.toContain(used.vendor.id);

    // With the toggle, "active" means "sourced from", submitted or not.
    const active = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ vendor_activity: 'active' }),
      adminToken
    );
    const row = active.body.data.find((r) => r.vendor.id === used.vendor.id);
    expect(row).toBeTruthy();
    expect(row.profiles_sourced).toBe(1);
    expect(row.profiles_submitted).toBe(1);
  });

  test('filters by origin_owner_id (brought by)', async () => {
    const mine = await createBareVendor(bda.id);
    const other = await createBareVendor(bda2.id);

    const res = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ origin_owner_id: bda2.id }),
      adminToken
    );
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.vendor.id);
    expect(ids).toContain(other.id);
    expect(ids).not.toContain(mine.id);
  });

  test('date_from / date_to scopes the sourced-profile count', async () => {
    const v = await seedVendorProfile(recruiterToken); // 1 profile, created now
    await prisma.profile.update({ where: { id: v.profile.id }, data: { created_at: new Date('2020-01-01') } });

    const inWindow = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ vendor_activity: 'active' }),
      adminToken
    );
    expect(inWindow.body.data.map((r) => r.vendor.id)).toContain(v.vendor.id);

    const afterCutoff = await authed(
      request(app)
        .get('/api/v1/reports/recruiter-vendor-gaps')
        .query({ vendor_activity: 'active', date_from: '2024-01-01' }),
      adminToken
    );
    // The only sourced profile is outside the window → nothing sourced in range.
    expect(afterCutoff.body.data.map((r) => r.vendor.id)).not.toContain(v.vendor.id);
  });

  test('filters by vendor_id and by owner_id (our POC)', async () => {
    const a = await seedVendorProfile(recruiterToken);
    const b = await seedVendorProfile(recruiterToken);
    const otherPoc = await createBareVendor(bda2.id);

    const byVendor = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ vendor_id: a.vendor.id }),
      adminToken
    );
    expect(byVendor.status).toBe(200);
    expect(byVendor.body.data.map((r) => r.vendor.id)).toEqual([a.vendor.id]);

    const byOwner = await authed(
      request(app).get('/api/v1/reports/recruiter-vendor-gaps').query({ owner_id: bda2.id }),
      adminToken
    );
    expect(byOwner.status).toBe(200);
    const ownerVendorIds = byOwner.body.data.map((r) => r.vendor.id);
    expect(ownerVendorIds).toContain(otherPoc.id);
    expect(ownerVendorIds).not.toContain(a.vendor.id);
    expect(ownerVendorIds).not.toContain(b.vendor.id);
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
