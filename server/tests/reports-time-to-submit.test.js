const {
  app,
  prisma,
  request,
  cleanDatabase,
  createUser,
  loginAs,
  createActiveClientAccount,
  createRequirement,
  createInterviewRound,
  authed,
  unique,
} = require('./helpers');

let adminToken;
let salesToken;
let recruiterToken;
let recruiter;
let seatId;

async function mkProfile() {
  return prisma.profile.create({
    data: { name: unique('Cand '), total_experience_years: 4, primary_skills: ['Node.js'], source: 'direct', added_by: recruiter.id },
  });
}

beforeEach(async () => {
  await cleanDatabase();
  const admin = await createUser({ role: 'admin' });
  const sales = await createUser({ role: 'sales' });
  recruiter = await createUser({ role: 'recruiter' });
  ({ access_token: adminToken } = await loginAs(admin));
  ({ access_token: salesToken } = await loginAs(sales));
  ({ access_token: recruiterToken } = await loginAs(recruiter));

  const account = await createActiveClientAccount(sales.id);
  const req = await createRequirement(salesToken, account.id);
  const seats = await authed(request(app).get(`/api/v1/requirements/${req.id}/seats`), salesToken);
  seatId = seats.body.data[0].id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const getTts = (token) =>
  authed(
    request(app).get('/api/v1/reports/time-to-submit').query({ date_from: '2020-01-01', date_to: '2100-01-01' }),
    token
  );

describe('GET /reports/time-to-submit', () => {
  test('admin + sales only', async () => {
    expect((await getTts(recruiterToken)).status).toBe(403);
    expect((await getTts(salesToken)).status).toBe(200);
    expect((await getTts(adminToken)).status).toBe(200);
  });

  const DAY = 24 * 3600 * 1000;

  test('a full funnel gets all three hop durations', async () => {
    const p = await mkProfile();
    await prisma.profile.update({ where: { id: p.id }, data: { created_at: new Date(Date.now() - 8 * DAY) } });
    const created = new Date(Date.now() - 5 * DAY); // submission row created 5d ago (profile sourced 8d ago)
    const sub = await prisma.submission.create({
      data: { requirement_seat_id: seatId, profile_id: p.id, submitted_by: recruiter.id, stage: 'submitted_to_client', created_at: created },
    });
    await createInterviewRound(sub.id, { round_type: 'internal_r1', scheduled_at: new Date(created.getTime() + 2 * DAY) }); // 3d ago
    await prisma.stageHistory.create({
      data: {
        entity_type: 'submission',
        entity_id: sub.id,
        from_stage: 'internal_screening',
        to_stage: 'submitted_to_client',
        changed_by: recruiter.id,
        changed_at: new Date(created.getTime() + 4 * DAY), // 1d ago
      },
    });

    const row = (await getTts(adminToken)).body.data.rows.find((r) => r.candidate === p.name);
    // 8d->5d ago = ~3d ; 5d->3d ago = ~2d ; 3d->1d ago = ~2d
    expect(row.sourced_to_submission.ms).toBeGreaterThan(2.5 * DAY);
    expect(row.submission_to_r1.ms).toBeGreaterThan(1.5 * DAY);
    expect(row.r1_to_submitted.ms).toBeGreaterThan(1.5 * DAY);
    expect(row.sourced_to_submission.label).toMatch(/\d/);
    expect(row.sourcer).toBe(recruiter.name);
  });

  test('filters by sourcer, client, requirement and candidate search', async () => {
    const other = await createUser({ role: 'recruiter', name: 'Other Rec' });
    const pMine = await prisma.profile.create({
      data: { name: 'Alpha Candidate', total_experience_years: 3, primary_skills: ['x'], source: 'direct', added_by: recruiter.id },
    });
    const pOther = await prisma.profile.create({
      data: { name: 'Beta Candidate', total_experience_years: 3, primary_skills: ['x'], source: 'direct', added_by: other.id },
    });
    await prisma.submission.create({ data: { requirement_seat_id: seatId, profile_id: pMine.id, submitted_by: recruiter.id, stage: 'sourced' } });
    await prisma.submission.create({ data: { requirement_seat_id: seatId, profile_id: pOther.id, submitted_by: other.id, stage: 'sourced' } });

    const bySourcer = await authed(
      request(app).get('/api/v1/reports/time-to-submit').query({ date_from: '2020-01-01', date_to: '2100-01-01', sourcer_id: recruiter.id }),
      adminToken
    );
    expect(bySourcer.body.data.rows.every((r) => r.sourcer === recruiter.name)).toBe(true);
    expect(bySourcer.body.data.rows.some((r) => r.candidate === 'Beta Candidate')).toBe(false);

    const bySearch = await authed(
      request(app).get('/api/v1/reports/time-to-submit').query({ date_from: '2020-01-01', date_to: '2100-01-01', search: 'alpha' }),
      adminToken
    );
    expect(bySearch.body.data.rows.map((r) => r.candidate)).toEqual(['Alpha Candidate']);
  });

  test('an in-flight submission shows blanks for unreached stages', async () => {
    const p = await mkProfile();
    const sub = await prisma.submission.create({
      data: { requirement_seat_id: seatId, profile_id: p.id, submitted_by: recruiter.id, stage: 'sourced' },
    });

    const row = (await getTts(adminToken)).body.data.rows.find((r) => r.id === sub.id);
    expect(row.submission_to_r1).toMatchObject({ ms: null, label: null });
    expect(row.r1_to_submitted).toMatchObject({ ms: null, label: null });
    // sourced -> submission created is always known
    expect(row.sourced_to_submission.ms).not.toBeNull();
  });

  test('date range filters on submission.created_at', async () => {
    const p = await mkProfile();
    const old = new Date('2019-06-01T00:00:00Z');
    await prisma.submission.create({
      data: { requirement_seat_id: seatId, profile_id: p.id, submitted_by: recruiter.id, stage: 'sourced', created_at: old },
    });
    const res = await authed(
      request(app).get('/api/v1/reports/time-to-submit').query({ date_from: '2025-01-01', date_to: '2100-01-01' }),
      adminToken
    );
    expect(res.body.data.rows.some((r) => r.candidate === p.name)).toBe(false);
  });
});
