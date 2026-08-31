/**
 * Base seed: departments + Delphic team roster only.
 * Domain data (accounts, requirements) comes from `npm run seed:jira`.
 *
 * Login password for every user: Password123!
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { DEFAULT_SEED_PASSWORD, DEPARTMENT_NAMES, TEAM_ROSTER } = require('./team-roster');

const prisma = new PrismaClient();

async function wipeAll() {
  await prisma.interviewRound.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.stageHistory.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.requirementAssignment.deleteMany();
  await prisma.requirementSeat.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.accountMeetingAttendee.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
}

async function seedDepartments() {
  const byName = {};
  for (const name of DEPARTMENT_NAMES) {
    byName[name] = await prisma.department.create({ data: { name } });
  }
  return byName;
}

async function seedUsers(password_hash, departments) {
  for (const member of TEAM_ROSTER) {
    const department_id = member.department ? departments[member.department].id : null;
    await prisma.user.create({
      data: {
        name: member.name,
        email: member.email,
        password_hash,
        role: member.role,
        department_id,
        active: true,
      },
    });
  }

  const byEmail = {};
  for (const member of TEAM_ROSTER) {
    byEmail[member.email.toLowerCase()] = await prisma.user.findUnique({ where: { email: member.email } });
  }
  return byEmail;
}

async function main() {
  console.log('Wiping existing data…');
  await wipeAll();

  const password_hash = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);

  console.log('Seeding departments…');
  const departments = await seedDepartments();

  console.log('Seeding team roster…');
  await seedUsers(password_hash, departments);

  const counts = {
    departments: await prisma.department.count(),
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    requirements: await prisma.requirement.count(),
  };

  console.log('Base seed complete (team only — run `npm run seed:jira` for CSV data).');
  console.log(JSON.stringify(counts, null, 2));
  console.log('');
  console.log(`Login: *@delphic.in / ${DEFAULT_SEED_PASSWORD}`);
  console.log('  Admin:     admin@delphic.in, diksha.yadav@delphic.in, paras.gulati@delphic.in');
  console.log('  BDA:       chahak.pandya@delphic.in, dheeraj.kumar@delphic.in');
  console.log('  Sales:     tanvi.saxena@delphic.in');
  console.log('  Recruiter: Garv@delphic.in, prashant.hada@delphic.in, sarthak.solanki@delphic.in, …');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
