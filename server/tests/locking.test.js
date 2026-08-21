const { app, prisma, request, cleanDatabase, createUser, loginAs, authed } = require('./helpers');

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('record locking', () => {
  test('dropping an account locks it, blocking further edits, until an admin unlocks it', async () => {
    const bda = await createUser({ role: 'bda' });
    const admin = await createUser({ role: 'admin' });
    const { access_token: bdaToken } = await loginAs(bda);
    const { access_token: adminToken } = await loginAs(admin);

    const create = await authed(request(app).post('/api/v1/accounts'), bdaToken).send({
      type: 'client',
      name: 'Lockable Co',
    });
    expect(create.status).toBe(201);
    const accountId = create.body.data.id;

    const editBeforeLock = await authed(request(app).patch(`/api/v1/accounts/${accountId}`), bdaToken).send({
      industry: 'FinTech',
    });
    expect(editBeforeLock.status).toBe(200);

    // lead cannot drop directly — schedule a meeting first
    const toMeeting = await authed(request(app).post(`/api/v1/accounts/${accountId}/stage`), bdaToken).send({
      to_stage: 'meeting_scheduled',
      meeting_mode: 'online',
      meeting_date: new Date().toISOString(),
    });
    expect(toMeeting.status).toBe(200);

    const drop = await authed(request(app).post(`/api/v1/accounts/${accountId}/stage`), bdaToken).send({
      to_stage: 'dropped',
      reason: 'client went cold',
    });
    expect(drop.status).toBe(200);
    expect(drop.body.data.is_locked).toBe(true);

    const editAfterLock = await authed(request(app).patch(`/api/v1/accounts/${accountId}`), bdaToken).send({
      industry: 'Healthcare',
    });
    expect(editAfterLock.status).toBe(403);

    const transitionAfterLock = await authed(request(app).post(`/api/v1/accounts/${accountId}/stage`), bdaToken).send({
      to_stage: 'meeting_scheduled',
      meeting_mode: 'online',
      meeting_date: new Date().toISOString(),
    });
    // lock check runs before transition validity → 403, not 400
    expect(transitionAfterLock.status).toBe(403);

    const unlock = await authed(request(app).post(`/api/v1/admin/account/${accountId}/unlock`), adminToken).send({
      reason: 'reopening by mistake',
    });
    expect(unlock.status).toBe(200);

    const editAfterUnlock = await authed(request(app).patch(`/api/v1/accounts/${accountId}`), bdaToken).send({
      industry: 'Retail',
    });
    expect(editAfterUnlock.status).toBe(200);
    expect(editAfterUnlock.body.data.industry).toBe('Retail');
  });

  test('a non-admin cannot call the unlock endpoint', async () => {
    const bda = await createUser({ role: 'bda' });
    const { access_token } = await loginAs(bda);

    const create = await authed(request(app).post('/api/v1/accounts'), access_token).send({ type: 'client', name: 'X' });
    const res = await authed(request(app).post(`/api/v1/admin/account/${create.body.data.id}/unlock`), access_token).send({
      reason: 'trying anyway',
    });

    expect(res.status).toBe(403);
  });
});
