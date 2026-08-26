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
  test('owner can list documents; other bda is forbidden', async () => {
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
    fs.unlinkSync(tmp);
    expect(uploaded.status).toBe(201);

    const allowed = await authed(request(app).get('/api/v1/documents'), ownerToken).query({
      entity_type: 'account',
      entity_id: account.id,
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toHaveLength(1);

    const denied = await authed(request(app).get('/api/v1/documents'), otherToken).query({
      entity_type: 'account',
      entity_id: account.id,
    });
    expect(denied.status).toBe(403);
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

  test('unassigned recruiter cannot list requirement documents', async () => {
    const sales = await createUser({ role: 'sales' });
    const recruiter = await createUser({ role: 'recruiter' });
    const { access_token: salesToken } = await loginAs(sales);
    const { access_token: recruiterToken } = await loginAs(recruiter);
    const account = await createActiveClientAccount(sales.id);
    const requirement = await createRequirement(salesToken, account.id);

    const denied = await authed(request(app).get('/api/v1/documents'), recruiterToken).query({
      entity_type: 'requirement',
      entity_id: requirement.id,
    });
    expect(denied.status).toBe(403);
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
