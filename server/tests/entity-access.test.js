const path = require('path');
const fs = require('fs');
const {
  app,
  prisma,
  request,
  cleanDatabase,
  createUser,
  loginAs,
  createActiveClientAccount,
  createRequirement,
  authed,
} = require('./helpers');

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('document entity access', () => {
  test('any authenticated user can list an entity\'s documents; upload stays owner-only', async () => {
    const owner = await createUser({ role: 'bda' });
    const other = await createUser({ role: 'bda' });
    const { access_token: ownerToken } = await loginAs(owner);
    const { access_token: otherToken } = await loginAs(other);
    const account = await createActiveClientAccount(owner.id);

    const tmp = path.join(__dirname, 'tmp-doc-access.pdf');
    fs.writeFileSync(tmp, 'x');
    const uploaded = await authed(request(app).post('/api/v1/documents'), ownerToken)
      .field('entity_type', 'account')
      .field('entity_id', account.id)
      .field('label', 'Note')
      .attach('file', tmp, 'note.pdf');
    expect(uploaded.status).toBe(201);

    // Reads are open across roles — a resume / attachment must be visible to everyone.
    const asOwner = await authed(request(app).get('/api/v1/documents'), ownerToken).query({
      entity_type: 'account',
      entity_id: account.id,
    });
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.data).toHaveLength(1);

    const asOther = await authed(request(app).get('/api/v1/documents'), otherToken).query({
      entity_type: 'account',
      entity_id: account.id,
    });
    expect(asOther.status).toBe(200);
    expect(asOther.body.data).toHaveLength(1);

    // …but a non-owner still cannot attach a new file.
    const blockedUpload = await authed(request(app).post('/api/v1/documents'), otherToken)
      .field('entity_type', 'account')
      .field('entity_id', account.id)
      .field('label', 'Sneaky')
      .attach('file', tmp, 'note.pdf');
    fs.unlinkSync(tmp);
    expect(blockedUpload.status).toBe(403);
  });

  test('admin can list documents for any account', async () => {
    const owner = await createUser({ role: 'bda' });
    const admin = await createUser({ role: 'admin' });
    const { access_token: ownerToken } = await loginAs(owner);
    const { access_token: adminToken } = await loginAs(admin);
    const account = await createActiveClientAccount(owner.id);

    const tmp = path.join(__dirname, 'tmp-doc-admin.pdf');
    fs.writeFileSync(tmp, 'x');
    await authed(request(app).post('/api/v1/documents'), ownerToken)
      .field('entity_type', 'account')
      .field('entity_id', account.id)
      .field('label', 'Note')
      .attach('file', tmp, 'note.pdf');
    fs.unlinkSync(tmp);

    const listed = await authed(request(app).get('/api/v1/documents'), adminToken).query({
      entity_type: 'account',
      entity_id: account.id,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
  });

  test('an unassigned recruiter can list requirement documents (reads are open)', async () => {
    const sales = await createUser({ role: 'sales' });
    const recruiter = await createUser({ role: 'recruiter' });
    const { access_token: salesToken } = await loginAs(sales);
    const { access_token: recruiterToken } = await loginAs(recruiter);
    const account = await createActiveClientAccount(sales.id);
    const requirement = await createRequirement(salesToken, account.id);

    const res = await authed(request(app).get('/api/v1/documents'), recruiterToken).query({
      entity_type: 'requirement',
      entity_id: requirement.id,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('listing documents for a missing entity still 404s', async () => {
    const recruiter = await createUser({ role: 'recruiter' });
    const { access_token: recruiterToken } = await loginAs(recruiter);
    const res = await authed(request(app).get('/api/v1/documents'), recruiterToken).query({
      entity_type: 'requirement',
      entity_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(404);
  });
});

describe('comment entity access', () => {
  test('other bda cannot list comments on an owned account', async () => {
    const owner = await createUser({ role: 'bda' });
    const other = await createUser({ role: 'bda' });
    const { access_token: ownerToken } = await loginAs(owner);
    const { access_token: otherToken } = await loginAs(other);
    const account = await createActiveClientAccount(owner.id);

    const created = await authed(request(app).post('/api/v1/comments'), ownerToken).send({
      entity_type: 'account',
      entity_id: account.id,
      body: 'private note',
    });
    expect(created.status).toBe(201);

    const denied = await authed(request(app).get('/api/v1/comments'), otherToken).query({
      entity_type: 'account',
      entity_id: account.id,
    });
    expect(denied.status).toBe(403);
  });
});
