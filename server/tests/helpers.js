const bcrypt = require('bcryptjs');
const request = require('supertest');
const prisma = require('../src/config/db');
const app = require('../src/app');

const PASSWORD = 'Password123!';

async function cleanDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE stage_history, documents, comments, interview_rounds, submissions, requirement_assignments, requirement_seats, requirements, profiles, account_meeting_attendees, accounts, users RESTART IDENTITY CASCADE'
  );
}

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

async function createUser({ role, active = true, name, is_superadmin = false }) {
  const email = `${unique('user')}@test.local`;
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  return prisma.user.create({
    data: { name: name || `${role} tester`, email, password_hash, role, active, is_superadmin },
  });
}

async function loginAs(user) {
  const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function createActiveClientAccount(ownerId) {
  return prisma.account.create({
    data: { type: 'client', name: unique('Client '), stage: 'active', owner_id: ownerId, origin_owner_id: ownerId },
  });
}

async function createRequirement(salesToken, accountId, overrides = {}) {
  const res = await authed(request(app).post('/api/v1/requirements'), salesToken).send({
    account_id: accountId,
    title: unique('Req '),
    req_type: 'recruitment',
    seats_total: 1,
    ...overrides,
  });
  if (res.status !== 201) {
    throw new Error(`create requirement failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function createProfile(recruiterToken, overrides = {}) {
  const res = await authed(request(app).post('/api/v1/profiles'), recruiterToken).send({
    name: unique('Candidate '),
    total_experience_years: 5,
    primary_skills: ['Node.js'],
    source: 'direct',
    ...overrides,
  });
  if (res.status !== 201) {
    throw new Error(`create profile failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

function authed(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

module.exports = {
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
  PASSWORD,
  unique,
};
