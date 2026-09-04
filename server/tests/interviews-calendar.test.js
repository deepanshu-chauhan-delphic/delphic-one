/**
 * Interview calendar feed + feedback + cancel.
 *   GET /interviews         — date-windowed, role-scoped, `mine=1`
 *   POST /interviews/:id/feedback — assigned interviewer OR manager; writes the
 *                                   same InterviewRound row the panel shows
 *   POST /interviews/:id/cancel   — manager only; sets status + notifies
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
  createInterviewRound,
  authed,
} = require('./helpers');

const DAY = 24 * 60 * 60 * 1000;

let bda;
let sales;
let recruiterA;
let recruiterB;
let interviewer;
let salesToken;
let recruiterAToken;
let recruiterBToken;
let interviewerToken;
let submissionId;
let inRangeRoundId;
let outOfRangeRoundId;

beforeEach(async () => {
  await cleanDatabase();
  bda = await createUser({ role: 'bda' });
  sales = await createUser({ role: 'sales' });
  recruiterA = await createUser({ role: 'recruiter' });
  recruiterB = await createUser({ role: 'recruiter' });
  interviewer = await createUser({ role: 'recruiter' });
  ({ access_token: salesToken } = await loginAs(sales));
  ({ access_token: recruiterAToken } = await loginAs(recruiterA));
  ({ access_token: recruiterBToken } = await loginAs(recruiterB));
  ({ access_token: interviewerToken } = await loginAs(interviewer));

  const account = await createActiveClientAccount(bda.id);
  const requirement = await createRequirement(salesToken, account.id);
  const seats = await authed(request(app).get(`/api/v1/requirements/${requirement.id}/seats`), salesToken);
  const profile = await createProfile(recruiterAToken);
  const sub = await authed(request(app).post('/api/v1/submissions'), recruiterAToken).send({
    requirement_seat_id: seats.body.data[0].id,
    profile_id: profile.id,
    proposed_rate: 100,
    proposed_rate_currency: 'INR',
  });
  submissionId = sub.body.data.id;

  const inRange = await createInterviewRound(submissionId, {
    round_type: 'internal_r1',
    scheduled_at: new Date(Date.now() + 2 * DAY),
    interviewer_ids: [interviewer.id],
  });
  inRangeRoundId = inRange.id;

  const outOfRange = await createInterviewRound(submissionId, {
    round_type: 'client_r1',
    scheduled_at: new Date(Date.now() + 90 * DAY),
  });
  outOfRangeRoundId = outOfRange.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function calendar(token, params = {}) {
  const from = params.from || new Date(Date.now() - DAY).toISOString();
  const to = params.to || new Date(Date.now() + 30 * DAY).toISOString();
  return authed(request(app).get('/api/v1/interviews').query({ from, to, ...params }), token);
}

describe('GET /interviews', () => {
  test('returns only in-range rounds the user is scoped to', async () => {
    const res = await calendar(recruiterAToken);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e) => e.id);
    expect(ids).toContain(inRangeRoundId);
    expect(ids).not.toContain(outOfRangeRoundId);
  });

  test('an unrelated recruiter sees nothing', async () => {
    const res = await calendar(recruiterBToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('mine=1 surfaces rounds where the caller is an assigned interviewer', async () => {
    const res = await calendar(interviewerToken, { mine: '1' });
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e) => e.id);
    expect(ids).toContain(inRangeRoundId);
  });

  test('a cancelled round comes back with status "cancelled"', async () => {
    await authed(request(app).post(`/api/v1/interviews/${inRangeRoundId}/cancel`), recruiterAToken).send({
      reason: 'Client unavailable',
    });
    const res = await calendar(recruiterAToken, { status: 'cancelled' });
    const row = res.body.data.find((e) => e.id === inRangeRoundId);
    expect(row).toBeTruthy();
    expect(row.status).toBe('cancelled');
  });
});

describe('POST /interviews/:id/feedback', () => {
  test('an assigned interviewer may submit; result flips status to completed', async () => {
    const res = await authed(request(app).post(`/api/v1/interviews/${inRangeRoundId}/feedback`), interviewerToken).send({
      result: 'pass',
      feedback: 'Strong systems fundamentals',
      rating: 8,
    });
    expect(res.status).toBe(200);

    const round = await prisma.interviewRound.findUnique({ where: { id: inRangeRoundId } });
    expect(round.result).toBe('pass');
    expect(round.feedback).toBe('Strong systems fundamentals');
    expect(round.rating).toBe(8);
    expect(round.status).toBe('completed');
    expect(round.completed_at).not.toBeNull();
  });

  test('an unrelated user is forbidden', async () => {
    const res = await authed(request(app).post(`/api/v1/interviews/${inRangeRoundId}/feedback`), recruiterBToken).send({
      result: 'fail',
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /interviews/:id/cancel', () => {
  test('a manager cancels: fields set + notifications created', async () => {
    const res = await authed(request(app).post(`/api/v1/interviews/${inRangeRoundId}/cancel`), recruiterAToken).send({
      reason: 'Candidate withdrew',
    });
    expect(res.status).toBe(200);

    const round = await prisma.interviewRound.findUnique({ where: { id: inRangeRoundId } });
    expect(round.status).toBe('cancelled');
    expect(round.cancellation_reason).toBe('Candidate withdrew');
    expect(round.cancelled_at).not.toBeNull();

    const notifs = await prisma.notification.findMany({ where: { type: 'interview_cancelled' } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  test('an unrelated user cannot cancel', async () => {
    const res = await authed(request(app).post(`/api/v1/interviews/${inRangeRoundId}/cancel`), recruiterBToken).send({
      reason: 'nope',
    });
    expect(res.status).toBe(403);
  });
});
