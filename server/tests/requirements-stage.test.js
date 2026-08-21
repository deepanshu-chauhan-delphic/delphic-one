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

let salesToken;
let recruiter;
let recruiterToken;
let account;

beforeEach(async () => {
  await cleanDatabase();
  const sales = await createUser({ role: 'sales' });
  recruiter = await createUser({ role: 'recruiter' });
  ({ access_token: salesToken } = await loginAs(sales));
  ({ access_token: recruiterToken } = await loginAs(recruiter));
  account = await createActiveClientAccount(sales.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('requirement status machine', () => {
  test('new requirements start as open with seats_total seats', async () => {
    const req = await createRequirement(salesToken, account.id, { seats_total: 2 });
    expect(req.status).toBe('open');
    expect(req.seats_total).toBe(2);
    expect(req.is_locked).toBe(false);

    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    expect(seats.status).toBe(200);
    expect(seats.body.data).toHaveLength(2);
  });

  test('cannot close a requirement while seats are still open', async () => {
    const req = await createRequirement(salesToken, account.id);
    const res = await authed(request(app).post(`/api/v1/requirements/${req.id}/status`), salesToken).send({
      to_status: 'closed',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/seats/i);
  });

  test('dropping a requirement requires a reason and locks it', async () => {
    const req = await createRequirement(salesToken, account.id);

    const missing = await authed(request(app).post(`/api/v1/requirements/${req.id}/status`), salesToken).send({
      to_status: 'dropped',
    });
    expect(missing.status).toBe(400);

    const drop = await authed(request(app).post(`/api/v1/requirements/${req.id}/status`), salesToken).send({
      to_status: 'dropped',
      reason: 'client cancelled',
    });
    expect(drop.status).toBe(200);
    expect(drop.body.data.status).toBe('dropped');
    expect(drop.body.data.is_locked).toBe(true);
  });

  test('open -> in_progress -> on_hold -> in_progress is allowed', async () => {
    const req = await createRequirement(salesToken, account.id);

    const toProgress = await authed(request(app).post(`/api/v1/requirements/${req.id}/status`), salesToken).send({
      to_status: 'in_progress',
    });
    expect(toProgress.status).toBe(200);
    expect(toProgress.body.data.status).toBe('in_progress');

    const toHold = await authed(request(app).post(`/api/v1/requirements/${req.id}/status`), salesToken).send({
      to_status: 'on_hold',
    });
    expect(toHold.status).toBe(200);

    const back = await authed(request(app).post(`/api/v1/requirements/${req.id}/status`), salesToken).send({
      to_status: 'in_progress',
    });
    expect(back.status).toBe(200);
    expect(back.body.data.status).toBe('in_progress');
  });
});

describe('seat stage machine', () => {
  test('cannot skip from open straight to closed', async () => {
    const req = await createRequirement(salesToken, account.id);
    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    const seatId = seats.body.data[0].id;

    const res = await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({
      to_status: 'closed',
      joined_at: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
  });

  test('dropping a seat requires a reason', async () => {
    const req = await createRequirement(salesToken, account.id);
    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    const seatId = seats.body.data[0].id;

    const missing = await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({
      to_status: 'dropped',
    });
    expect(missing.status).toBe(400);

    const drop = await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({
      to_status: 'dropped',
      reason: 'role cancelled',
    });
    expect(drop.status).toBe(200);
    expect(drop.body.data.is_locked).toBe(true);
  });

  test('closing a seat requires joined_at', async () => {
    const req = await createRequirement(salesToken, account.id);
    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    const seatId = seats.body.data[0].id;

    for (const to_status of ['interviewing', 'offer', 'bgv']) {
      const step = await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({ to_status });
      expect(step.status).toBe(200);
    }

    const missing = await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({
      to_status: 'closed',
    });
    expect(missing.status).toBe(400);

    const closed = await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({
      to_status: 'closed',
      joined_at: new Date().toISOString(),
    });
    expect(closed.status).toBe(200);
    expect(closed.body.data.seat_status).toBe('closed');
    expect(closed.body.data.is_locked).toBe(true);
  });

  test('closing the last open seat auto-closes the parent requirement', async () => {
    const req = await createRequirement(salesToken, account.id, { seats_total: 1 });
    const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    const seatId = seats.body.data[0].id;

    for (const to_status of ['interviewing', 'offer', 'bgv']) {
      await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({ to_status });
    }
    await authed(request(app).post(`/api/v1/seats/${seatId}/stage`), salesToken).send({
      to_status: 'closed',
      joined_at: new Date().toISOString(),
    });

    const updated = await authed(request(app).get(`/api/v1/requirements/${req.id}`), salesToken);
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('closed');
    expect(updated.body.data.is_locked).toBe(true);
  });

  test('dropping the last open seat also auto-closes the parent requirement', async () => {
    const req = await createRequirement(salesToken, account.id, { seats_total: 2 });
    const seatsRes = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
    const [seatA, seatB] = seatsRes.body.data;

    await authed(request(app).post(`/api/v1/seats/${seatA.id}/stage`), salesToken).send({
      to_status: 'dropped',
      reason: 'filled elsewhere',
    });
    // one seat still open — requirement stays open
    let parent = await authed(request(app).get(`/api/v1/requirements/${req.id}`), salesToken);
    expect(parent.body.data.status).toBe('open');

    await authed(request(app).post(`/api/v1/seats/${seatB.id}/stage`), salesToken).send({
      to_status: 'dropped',
      reason: 'budget cut',
    });
    parent = await authed(request(app).get(`/api/v1/requirements/${req.id}`), salesToken);
    expect(parent.body.data.status).toBe('closed');
    expect(parent.body.data.is_locked).toBe(true);
  });
});

describe('requirement assignment', () => {
  test('sales can assign and unassign a recruiter', async () => {
    const req = await createRequirement(salesToken, account.id);

    const assigned = await authed(request(app).post(`/api/v1/requirements/${req.id}/assign`), salesToken).send({
      user_id: recruiter.id,
      role_on_req: 'recruiter',
    });
    expect(assigned.status).toBe(201);
    expect(assigned.body.data.user.id).toBe(recruiter.id);

    const duplicate = await authed(request(app).post(`/api/v1/requirements/${req.id}/assign`), salesToken).send({
      user_id: recruiter.id,
      role_on_req: 'recruiter',
    });
    expect(duplicate.status).toBe(400);

    const list = await authed(request(app).get(`/api/v1/requirements/${req.id}/assignments`), salesToken);
    expect(list.body.data.some((a) => a.user.id === recruiter.id && !a.unassigned_at)).toBe(true);

    const unassign = await authed(request(app).post(`/api/v1/requirements/${req.id}/unassign`), salesToken).send({
      assignment_id: assigned.body.data.id,
    });
    expect(unassign.status).toBe(200);

    const after = await authed(request(app).get(`/api/v1/requirements/${req.id}/assignments`), salesToken);
    const row = after.body.data.find((a) => a.id === assigned.body.data.id);
    expect(row.unassigned_at).toBeTruthy();
  });

  test('cannot assign a user whose role does not match role_on_req', async () => {
    const req = await createRequirement(salesToken, account.id);
    const res = await authed(request(app).post(`/api/v1/requirements/${req.id}/assign`), salesToken).send({
      user_id: recruiter.id,
      role_on_req: 'sales',
    });
    expect(res.status).toBe(400);
  });
});
