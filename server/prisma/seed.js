/**
 * Demo seed for local / Docker UI testing.
 *
 * Creates users (all roles) plus accounts, requirements, seats, profiles,
 * submissions, interview rounds, stage history, and comments so dashboards
 * and list pages are non-empty. Safe to re-run: wipes demo tables first.
 *
 * Login password for every user: Password123!
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

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
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
}

async function seedDepartments() {
  const sales = await prisma.department.create({ data: { name: 'Sales' } });
  const delivery = await prisma.department.create({ data: { name: 'Delivery' } });
  return { sales, delivery };
}

async function seedUsers(password_hash, departments) {
  await prisma.user.createMany({
    data: [
      {
        name: 'Admin User',
        email: 'admin@delphic.local',
        password_hash,
        role: 'admin',
        department_id: departments.sales.id,
      },
      {
        name: 'Admin Two',
        email: 'admin2@delphic.local',
        password_hash,
        role: 'admin',
        department_id: departments.delivery.id,
      },
      {
        name: 'Sales One',
        email: 'sales1@delphic.local',
        password_hash,
        role: 'sales',
        department_id: departments.sales.id,
      },
      {
        name: 'Sales Two',
        email: 'sales2@delphic.local',
        password_hash,
        role: 'sales',
        department_id: departments.sales.id,
      },
      {
        name: 'BDA One',
        email: 'bda1@delphic.local',
        password_hash,
        role: 'bda',
        department_id: departments.sales.id,
      },
      {
        name: 'BDA Two',
        email: 'bda2@delphic.local',
        password_hash,
        role: 'bda',
        department_id: departments.sales.id,
      },
      {
        name: 'Recruiter One',
        email: 'recruiter1@delphic.local',
        password_hash,
        role: 'recruiter',
        department_id: departments.delivery.id,
      },
      {
        name: 'Recruiter Two',
        email: 'recruiter2@delphic.local',
        password_hash,
        role: 'recruiter',
        department_id: departments.delivery.id,
      },
    ],
  });

  const byEmail = {};
  for (const email of [
    'admin@delphic.local',
    'admin2@delphic.local',
    'sales1@delphic.local',
    'sales2@delphic.local',
    'bda1@delphic.local',
    'bda2@delphic.local',
    'recruiter1@delphic.local',
    'recruiter2@delphic.local',
  ]) {
    byEmail[email] = await prisma.user.findUnique({ where: { email } });
  }
  return byEmail;
}

async function seedAccounts(users) {
  const bda = users['bda1@delphic.local'];
  const bda2 = users['bda2@delphic.local'];
  const sales = users['sales1@delphic.local'];
  const sales2 = users['sales2@delphic.local'];

  // Stuck lead (>7 days in lead) — shows on BDA / admin stuck lists
  const stuckLead = await prisma.account.create({
    data: {
      type: 'client',
      name: 'Stuck Lead Corp',
      stage: 'lead',
      industry: 'FinTech',
      company_size: 'startup',
      location_city: 'Pune',
      location_country: 'IN',
      poc_name: 'Asha Lead',
      poc_email: 'asha@stucklead.example',
      source: 'cold_call',
      owner_id: bda.id,
      created_at: daysAgo(20),
      updated_at: daysAgo(14),
    },
  });

  const meetingLead = await prisma.account.create({
    data: {
      type: 'client',
      name: 'Meeting Scheduled Ltd',
      stage: 'meeting_scheduled',
      industry: 'Healthcare',
      company_size: 'mid',
      location_city: 'Bangalore',
      location_country: 'IN',
      poc_name: 'Ravi Meet',
      poc_email: 'ravi@meetingsched.example',
      meeting_mode: 'online',
      meeting_date: daysAgo(-3),
      source: 'referral',
      owner_id: bda.id,
      created_at: daysAgo(5),
      updated_at: daysAgo(2),
    },
  });

  const activeClient = await prisma.account.create({
    data: {
      type: 'client',
      name: 'Acme Active Client',
      stage: 'active',
      industry: 'SaaS',
      company_size: 'enterprise',
      website: 'https://acme.example',
      location_city: 'Mumbai',
      location_country: 'IN',
      gst_or_tax_id: '27AABCU9603R1ZM',
      poc_name: 'Priya Client',
      poc_email: 'priya@acme.example',
      poc_phone: '+91-9876543210',
      poc_designation: 'Hiring Manager',
      client_billing_currency: 'INR',
      client_payment_terms: 'Net 30',
      source: 'inbound',
      owner_id: bda.id,
      created_at: daysAgo(60),
      updated_at: daysAgo(3),
    },
  });

  const secondClient = await prisma.account.create({
    data: {
      type: 'client',
      name: 'Nova Softwares',
      stage: 'active',
      industry: 'IT Services',
      company_size: 'mid',
      location_city: 'Hyderabad',
      location_country: 'IN',
      poc_name: 'Kiran Nova',
      poc_email: 'kiran@nova.example',
      client_billing_currency: 'USD',
      owner_id: bda.id,
      created_at: daysAgo(40),
      updated_at: daysAgo(1),
    },
  });

  const vendor = await prisma.account.create({
    data: {
      type: 'vendor',
      name: 'Talent Vendor Partners',
      stage: 'active',
      industry: 'Staffing',
      company_size: 'small',
      location_city: 'Delhi',
      location_country: 'IN',
      poc_name: 'Vendor Poc',
      poc_email: 'desk@talentvendor.example',
      vendor_specializations: ['Java', 'React', 'DevOps'],
      vendor_rate_range: { min: 40000, max: 120000, currency: 'INR' },
      vendor_payment_terms: 'Net 15',
      owner_id: sales.id,
      created_at: daysAgo(90),
      updated_at: daysAgo(10),
    },
  });

  const vendor2 = await prisma.account.create({
    data: {
      type: 'vendor',
      name: 'Skillbridge Staffing',
      stage: 'active',
      industry: 'Staffing',
      company_size: 'small',
      location_city: 'Noida',
      location_country: 'IN',
      poc_name: 'Vendor Two Poc',
      poc_email: 'desk@skillbridge.example',
      vendor_specializations: ['Data', 'QA', 'Mobile'],
      vendor_rate_range: { min: 35000, max: 100000, currency: 'INR' },
      vendor_payment_terms: 'Net 30',
      owner_id: sales2.id,
      created_at: daysAgo(200),
      updated_at: daysAgo(20),
    },
  });

  const droppedLead = await prisma.account.create({
    data: {
      type: 'client',
      name: 'Dropped Ventures',
      stage: 'dropped',
      industry: 'Retail',
      company_size: 'small',
      location_city: 'Jaipur',
      location_country: 'IN',
      poc_name: 'Dev Dropped',
      poc_email: 'dev@droppedventures.example',
      source: 'cold_call',
      owner_id: bda2.id,
      is_locked: true,
      created_at: daysAgo(50),
      updated_at: daysAgo(30),
    },
  });

  const rescheduledLead = await prisma.account.create({
    data: {
      type: 'client',
      name: 'Rescheduled Retail Co',
      stage: 'rescheduled',
      industry: 'Retail',
      company_size: 'mid',
      location_city: 'Ahmedabad',
      location_country: 'IN',
      poc_name: 'Resh Contact',
      poc_email: 'resh@reschedretail.example',
      meeting_mode: 'online',
      meeting_date: daysAgo(-7),
      source: 'referral',
      owner_id: bda2.id,
      created_at: daysAgo(25),
      updated_at: daysAgo(6),
    },
  });

  await prisma.stageHistory.createMany({
    data: [
      {
        entity_type: 'account',
        entity_id: stuckLead.id,
        from_stage: null,
        to_stage: 'lead',
        changed_by: bda.id,
        changed_at: daysAgo(20),
      },
      {
        entity_type: 'account',
        entity_id: meetingLead.id,
        from_stage: 'lead',
        to_stage: 'meeting_scheduled',
        changed_by: bda.id,
        changed_at: daysAgo(2),
      },
      {
        entity_type: 'account',
        entity_id: activeClient.id,
        from_stage: 'meeting_scheduled',
        to_stage: 'active',
        changed_by: bda.id,
        reason: 'Signed MSA',
        changed_at: daysAgo(45),
      },
      {
        entity_type: 'account',
        entity_id: droppedLead.id,
        from_stage: null,
        to_stage: 'lead',
        changed_by: bda2.id,
        changed_at: daysAgo(50),
      },
      {
        entity_type: 'account',
        entity_id: droppedLead.id,
        from_stage: 'lead',
        to_stage: 'meeting_scheduled',
        changed_by: bda2.id,
        changed_at: daysAgo(45),
      },
      {
        entity_type: 'account',
        entity_id: droppedLead.id,
        from_stage: 'meeting_scheduled',
        to_stage: 'dropped',
        changed_by: bda2.id,
        reason: 'Budget frozen this quarter',
        changed_at: daysAgo(30),
      },
      {
        entity_type: 'account',
        entity_id: rescheduledLead.id,
        from_stage: null,
        to_stage: 'lead',
        changed_by: bda2.id,
        changed_at: daysAgo(25),
      },
      {
        entity_type: 'account',
        entity_id: rescheduledLead.id,
        from_stage: 'lead',
        to_stage: 'meeting_scheduled',
        changed_by: bda2.id,
        changed_at: daysAgo(15),
      },
      {
        entity_type: 'account',
        entity_id: rescheduledLead.id,
        from_stage: 'meeting_scheduled',
        to_stage: 'rescheduled',
        changed_by: bda2.id,
        reason: 'POC travelling, pushed a week',
        changed_at: daysAgo(6),
      },
    ],
  });

  await prisma.comment.create({
    data: {
      entity_type: 'account',
      entity_id: stuckLead.id,
      user_id: bda.id,
      body: 'No reply after two follow-ups — keep on stuck list.',
      created_at: daysAgo(10),
    },
  });

  await prisma.document.create({
    data: {
      entity_type: 'account',
      entity_id: activeClient.id,
      label: 'Master Service Agreement',
      file_url: '/uploads/demo/msa-acme-active-client.pdf',
      file_type: 'application/pdf',
      file_size_bytes: 143360,
      uploaded_by: bda.id,
      uploaded_at: daysAgo(45),
    },
  });

  return { stuckLead, meetingLead, activeClient, secondClient, vendor, vendor2, droppedLead, rescheduledLead };
}

async function seedRequirements(users, accounts) {
  const sales = users['sales1@delphic.local'];
  const sales2 = users['sales2@delphic.local'];
  const admin = users['admin@delphic.local'];
  const rec1 = users['recruiter1@delphic.local'];
  const rec2 = users['recruiter2@delphic.local'];
  const { activeClient, secondClient } = accounts;

  // Stuck open req (created >7 days ago, still open)
  const stuckReq = await prisma.requirement.create({
    data: {
      account_id: activeClient.id,
      title: 'Stuck Senior Java Developer',
      req_type: 'developer',
      status: 'open',
      description: 'Need Java 17 + Spring Boot. No submissions yet — aging.',
      designation: 'Senior Java Developer',
      department: 'Engineering',
      seats_total: 2,
      primary_tech_stack: ['Java', 'Spring Boot'],
      secondary_tech_stack: ['Kafka'],
      experience_min: 5,
      experience_max: 10,
      work_mode: 'hybrid',
      work_location: 'Pune',
      engagement_type: 'full_time',
      budget_min: 1800000,
      budget_max: 2500000,
      budget_currency: 'INR',
      budget_type: 'annual',
      priority: 'high',
      sla_days: 14,
      sales_owner_id: sales.id,
      created_at: daysAgo(18),
      updated_at: daysAgo(12),
    },
  });

  const inProgressReq = await prisma.requirement.create({
    data: {
      account_id: activeClient.id,
      title: 'React Frontend Engineer',
      req_type: 'developer',
      status: 'in_progress',
      description: 'SPA work on customer portal.',
      designation: 'Frontend Engineer',
      department: 'Product',
      seats_total: 4,
      primary_tech_stack: ['React', 'TypeScript'],
      secondary_tech_stack: ['Tailwind'],
      experience_min: 3,
      experience_max: 7,
      work_mode: 'remote',
      engagement_type: 'full_time',
      budget_min: 1200000,
      budget_max: 1800000,
      budget_currency: 'INR',
      budget_type: 'annual',
      priority: 'urgent',
      sla_days: 21,
      sales_owner_id: sales.id,
      created_at: daysAgo(10),
      updated_at: daysAgo(1),
    },
  });

  const projectReq = await prisma.requirement.create({
    data: {
      account_id: secondClient.id,
      title: 'DevOps Project Squad',
      req_type: 'project',
      status: 'open',
      description: 'Short project for CI/CD hardening.',
      designation: 'DevOps Engineer',
      seats_total: 2,
      primary_tech_stack: ['AWS', 'Terraform', 'Kubernetes'],
      experience_min: 4,
      experience_max: 8,
      work_mode: 'onsite',
      work_location: 'Hyderabad',
      engagement_type: 'contract',
      contract_duration_months: 6,
      budget_min: 80000,
      budget_max: 120000,
      budget_currency: 'USD',
      budget_type: 'monthly',
      priority: 'medium',
      sla_days: 30,
      sales_owner_id: sales.id,
      created_at: daysAgo(4),
      updated_at: daysAgo(1),
    },
  });

  const closedReq = await prisma.requirement.create({
    data: {
      account_id: activeClient.id,
      title: 'Closed QA Automation (filled)',
      req_type: 'developer',
      status: 'closed',
      description: 'Filled this month — for closed_this_month metric.',
      designation: 'QA Automation',
      seats_total: 1,
      primary_tech_stack: ['Selenium', 'Java'],
      experience_min: 2,
      experience_max: 5,
      work_mode: 'remote',
      engagement_type: 'full_time',
      budget_currency: 'INR',
      budget_type: 'annual',
      priority: 'low',
      sales_owner_id: sales.id,
      closed_at: daysAgo(3),
      created_at: daysAgo(35),
      updated_at: daysAgo(3),
    },
  });

  const onHoldReq = await prisma.requirement.create({
    data: {
      account_id: secondClient.id,
      title: 'Data Engineer (on hold — budget review)',
      req_type: 'developer',
      status: 'on_hold',
      description: 'Client paused hiring pending Q3 budget approval.',
      designation: 'Data Engineer',
      department: 'Data',
      seats_total: 1,
      primary_tech_stack: ['Python', 'Spark', 'Airflow'],
      experience_min: 3,
      experience_max: 6,
      work_mode: 'remote',
      engagement_type: 'full_time',
      budget_min: 1400000,
      budget_max: 1900000,
      budget_currency: 'INR',
      budget_type: 'annual',
      priority: 'low',
      sla_days: 21,
      sales_owner_id: sales2.id,
      created_at: daysAgo(220),
      updated_at: daysAgo(160),
    },
  });

  const droppedReq = await prisma.requirement.create({
    data: {
      account_id: activeClient.id,
      title: 'Dropped Mobile Engineer',
      req_type: 'developer',
      status: 'dropped',
      description: 'Client cancelled after headcount freeze.',
      designation: 'Mobile Engineer',
      seats_total: 1,
      primary_tech_stack: ['React Native', 'iOS'],
      experience_min: 3,
      experience_max: 6,
      work_mode: 'hybrid',
      engagement_type: 'full_time',
      budget_currency: 'INR',
      budget_type: 'annual',
      priority: 'medium',
      sales_owner_id: sales.id,
      closed_at: daysAgo(90),
      created_at: daysAgo(180),
      updated_at: daysAgo(90),
    },
  });

  const stuckSeats = await Promise.all([
    prisma.requirementSeat.create({
      data: { requirement_id: stuckReq.id, seat_label: 'Seat 1', seat_status: 'open' },
    }),
    prisma.requirementSeat.create({
      data: { requirement_id: stuckReq.id, seat_label: 'Seat 2', seat_status: 'open' },
    }),
  ]);

  const reactSeats = await Promise.all([
    prisma.requirementSeat.create({
      data: {
        requirement_id: inProgressReq.id,
        seat_label: 'Seat 1',
        seat_status: 'interviewing',
      },
    }),
    prisma.requirementSeat.create({
      data: { requirement_id: inProgressReq.id, seat_label: 'Seat 2', seat_status: 'open' },
    }),
    prisma.requirementSeat.create({
      data: { requirement_id: inProgressReq.id, seat_label: 'Seat 3', seat_status: 'bgv' },
    }),
    prisma.requirementSeat.create({
      data: { requirement_id: inProgressReq.id, seat_label: 'Seat 4', seat_status: 'open' },
    }),
  ]);

  const devopsSeat = await prisma.requirementSeat.create({
    data: { requirement_id: projectReq.id, seat_label: 'Seat 1', seat_status: 'open' },
  });

  const devopsSeat2 = await prisma.requirementSeat.create({
    data: { requirement_id: projectReq.id, seat_label: 'Seat 2', seat_status: 'open' },
  });

  const closedSeat = await prisma.requirementSeat.create({
    data: {
      requirement_id: closedReq.id,
      seat_label: 'Seat 1',
      seat_status: 'closed',
      closed_at: daysAgo(3),
      joined_at: daysAgo(3),
    },
  });

  const onHoldSeat = await prisma.requirementSeat.create({
    data: { requirement_id: onHoldReq.id, seat_label: 'Seat 1', seat_status: 'open' },
  });

  const droppedSeat = await prisma.requirementSeat.create({
    data: { requirement_id: droppedReq.id, seat_label: 'Seat 1', seat_status: 'dropped', closed_at: daysAgo(90) },
  });

  await prisma.requirementAssignment.createMany({
    data: [
      {
        requirement_id: stuckReq.id,
        user_id: rec1.id,
        role_on_req: 'recruiter',
        assigned_by: sales.id,
        assigned_at: daysAgo(17),
      },
      {
        requirement_id: inProgressReq.id,
        user_id: rec1.id,
        role_on_req: 'recruiter',
        assigned_by: sales.id,
        assigned_at: daysAgo(9),
      },
      {
        requirement_id: inProgressReq.id,
        user_id: rec2.id,
        role_on_req: 'recruiter',
        assigned_by: sales.id,
        assigned_at: daysAgo(8),
      },
      {
        requirement_id: projectReq.id,
        user_id: rec2.id,
        role_on_req: 'recruiter',
        assigned_by: admin.id,
        assigned_at: daysAgo(3),
      },
      {
        requirement_id: onHoldReq.id,
        user_id: rec2.id,
        role_on_req: 'recruiter',
        assigned_by: sales2.id,
        assigned_at: daysAgo(215),
      },
      {
        requirement_id: closedReq.id,
        user_id: rec1.id,
        role_on_req: 'recruiter',
        assigned_by: sales.id,
        assigned_at: daysAgo(30),
        unassigned_at: daysAgo(3),
      },
    ],
  });

  await prisma.stageHistory.createMany({
    data: [
      {
        entity_type: 'requirement',
        entity_id: stuckReq.id,
        from_stage: null,
        to_stage: 'open',
        changed_by: sales.id,
        changed_at: daysAgo(18),
      },
      {
        entity_type: 'requirement',
        entity_id: inProgressReq.id,
        from_stage: 'open',
        to_stage: 'in_progress',
        changed_by: sales.id,
        changed_at: daysAgo(8),
      },
      {
        entity_type: 'requirement',
        entity_id: closedReq.id,
        from_stage: 'in_progress',
        to_stage: 'closed',
        changed_by: sales.id,
        reason: 'All seats filled',
        changed_at: daysAgo(3),
      },
      {
        entity_type: 'seat',
        entity_id: reactSeats[0].id,
        from_stage: 'open',
        to_stage: 'interviewing',
        changed_by: rec1.id,
        changed_at: daysAgo(5),
      },
      {
        entity_type: 'requirement',
        entity_id: onHoldReq.id,
        from_stage: null,
        to_stage: 'open',
        changed_by: sales2.id,
        changed_at: daysAgo(220),
      },
      {
        entity_type: 'requirement',
        entity_id: onHoldReq.id,
        from_stage: 'open',
        to_stage: 'on_hold',
        changed_by: sales2.id,
        reason: 'Client budget review',
        changed_at: daysAgo(160),
      },
      {
        entity_type: 'requirement',
        entity_id: droppedReq.id,
        from_stage: null,
        to_stage: 'open',
        changed_by: sales.id,
        changed_at: daysAgo(180),
      },
      {
        entity_type: 'requirement',
        entity_id: droppedReq.id,
        from_stage: 'open',
        to_stage: 'dropped',
        changed_by: sales.id,
        reason: 'Headcount freeze',
        changed_at: daysAgo(90),
      },
      {
        entity_type: 'seat',
        entity_id: droppedSeat.id,
        from_stage: 'open',
        to_stage: 'dropped',
        changed_by: sales.id,
        reason: 'Headcount freeze',
        changed_at: daysAgo(90),
      },
    ],
  });

  return {
    stuckReq,
    inProgressReq,
    projectReq,
    closedReq,
    onHoldReq,
    droppedReq,
    stuckSeats,
    reactSeats,
    onHoldSeat,
    droppedSeat,
    devopsSeat,
    devopsSeat2,
    closedSeat,
  };
}

async function seedProfiles(users, accounts) {
  const rec1 = users['recruiter1@delphic.local'];
  const rec2 = users['recruiter2@delphic.local'];
  const { vendor } = accounts;

  const ananya = await prisma.profile.create({
    data: {
      name: 'Ananya Sharma',
      email: 'ananya.sharma@example.com',
      phone: '+91-9000000001',
      current_location: 'Pune',
      current_company: 'TechNova',
      current_designation: 'Senior Frontend',
      total_experience_years: 6,
      relevant_experience_years: 5,
      primary_skills: ['React', 'TypeScript', 'Node'],
      secondary_skills: ['GraphQL'],
      current_ctc: 1800000,
      expected_ctc: 2200000,
      notice_period_days: 30,
      source: 'internal',
      added_by: rec1.id,
      recruiter_notes: 'Strong SPA portfolio.',
      is_active: true,
      created_at: daysAgo(12),
    },
  });

  const rohan = await prisma.profile.create({
    data: {
      name: 'Rohan Mehta',
      email: 'rohan.mehta@example.com',
      phone: '+91-9000000002',
      current_location: 'Mumbai',
      current_company: 'BankSoft',
      current_designation: 'Java Lead',
      total_experience_years: 8,
      relevant_experience_years: 7,
      primary_skills: ['Java', 'Spring Boot', 'Kafka'],
      current_ctc: 2400000,
      expected_ctc: 2800000,
      notice_period_days: 60,
      source: 'linkedin',
      linkedin_url: 'https://linkedin.com/in/rohan-mehta-demo',
      added_by: rec1.id,
      is_active: true,
      created_at: daysAgo(15),
    },
  });

  const neha = await prisma.profile.create({
    data: {
      name: 'Neha Iyer',
      email: 'neha.iyer@example.com',
      current_location: 'Bangalore',
      current_company: 'CloudOps Inc',
      current_designation: 'DevOps Engineer',
      total_experience_years: 5,
      primary_skills: ['AWS', 'Kubernetes', 'Terraform'],
      current_ctc: 2000000,
      expected_ctc: 2400000,
      notice_period_days: 15,
      source: 'vendor',
      vendor_account_id: vendor.id,
      vendor_profile_id: 'TVP-441',
      added_by: rec2.id,
      is_active: true,
      created_at: daysAgo(6),
    },
  });

  const vikram = await prisma.profile.create({
    data: {
      name: 'Vikram Das',
      email: 'vikram.das@example.com',
      current_location: 'Hyderabad',
      current_company: 'QA Labs',
      current_designation: 'SDET',
      total_experience_years: 4,
      primary_skills: ['Selenium', 'Java', 'TestNG'],
      source: 'internal',
      added_by: rec1.id,
      is_active: true,
      created_at: daysAgo(40),
    },
  });

  const inactive = await prisma.profile.create({
    data: {
      name: 'Inactive Candidate',
      email: 'inactive@example.com',
      current_location: 'Chennai',
      total_experience_years: 3,
      primary_skills: ['Python'],
      source: 'internal',
      added_by: rec2.id,
      is_active: false,
      created_at: daysAgo(100),
    },
  });

  const priya = await prisma.profile.create({
    data: {
      name: 'Priya Nair',
      email: 'priya.nair@example.com',
      phone: '+91-9000000006',
      current_location: 'Kochi',
      current_company: 'DataWorks',
      current_designation: 'Data Engineer',
      total_experience_years: 5,
      relevant_experience_years: 4,
      primary_skills: ['Python', 'Spark', 'Airflow'],
      secondary_skills: ['AWS'],
      current_ctc: 1600000,
      expected_ctc: 1900000,
      notice_period_days: 30,
      source: 'internal',
      added_by: rec2.id,
      is_active: true,
      created_at: daysAgo(70),
    },
  });

  const arjun = await prisma.profile.create({
    data: {
      name: 'Arjun Malhotra',
      email: 'arjun.malhotra@example.com',
      current_location: 'Gurgaon',
      current_company: 'MobileFirst',
      current_designation: 'Mobile Engineer',
      total_experience_years: 4,
      primary_skills: ['React Native', 'iOS', 'Swift'],
      current_ctc: 1500000,
      expected_ctc: 1800000,
      notice_period_days: 45,
      source: 'linkedin',
      added_by: rec2.id,
      is_active: true,
      created_at: daysAgo(130),
    },
  });

  const sneha = await prisma.profile.create({
    data: {
      name: 'Sneha Reddy',
      email: 'sneha.reddy@example.com',
      current_location: 'Hyderabad',
      current_company: 'CloudOps Inc',
      current_designation: 'DevOps Lead',
      total_experience_years: 7,
      primary_skills: ['AWS', 'Terraform', 'Docker'],
      current_ctc: 2600000,
      expected_ctc: 3000000,
      notice_period_days: 60,
      source: 'vendor',
      vendor_account_id: vendor.id,
      vendor_profile_id: 'TVP-509',
      added_by: rec2.id,
      is_active: true,
      created_at: daysAgo(180),
    },
  });

  const karan = await prisma.profile.create({
    data: {
      name: 'Karan Kapoor',
      email: 'karan.kapoor@example.com',
      current_location: 'Delhi',
      current_company: 'Fintech Labs',
      current_designation: 'Backend Engineer',
      total_experience_years: 6,
      primary_skills: ['Java', 'Spring Boot', 'PostgreSQL'],
      current_ctc: 2100000,
      expected_ctc: 2500000,
      notice_period_days: 30,
      source: 'internal',
      added_by: rec1.id,
      is_active: true,
      created_at: daysAgo(250),
    },
  });

  const meera = await prisma.profile.create({
    data: {
      name: 'Meera Pillai',
      email: 'meera.pillai@example.com',
      current_location: 'Chennai',
      current_company: 'QA Labs',
      current_designation: 'QA Automation Engineer',
      total_experience_years: 3,
      primary_skills: ['Selenium', 'Cypress', 'JavaScript'],
      current_ctc: 1100000,
      expected_ctc: 1400000,
      notice_period_days: 15,
      source: 'internal',
      added_by: rec1.id,
      is_active: true,
      created_at: daysAgo(20),
    },
  });

  return { ananya, rohan, neha, vikram, inactive, priya, arjun, sneha, karan, meera };
}

async function seedSubmissions(users, reqs, profiles) {
  const rec1 = users['recruiter1@delphic.local'];
  const rec2 = users['recruiter2@delphic.local'];
  const { reactSeats, devopsSeat, devopsSeat2, closedSeat, stuckSeats, onHoldSeat } = reqs;
  const { ananya, rohan, neha, vikram, priya, arjun, karan, meera } = profiles;

  // Funnel coverage across stages
  const sourced = await prisma.submission.create({
    data: {
      requirement_seat_id: stuckSeats[0].id,
      profile_id: rohan.id,
      stage: 'sourced',
      proposed_rate: 220000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 78,
      submission_notes: 'Sourced for stuck Java req — still early.',
      submitted_by: rec1.id,
      created_at: daysAgo(10),
      updated_at: daysAgo(10),
    },
  });

  const screening = await prisma.submission.create({
    data: {
      requirement_seat_id: reactSeats[1].id,
      profile_id: ananya.id,
      stage: 'internal_screening',
      proposed_rate: 180000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 88,
      submitted_by: rec1.id,
      created_at: daysAgo(7),
      updated_at: daysAgo(4),
    },
  });

  const interviewing = await prisma.submission.create({
    data: {
      requirement_seat_id: reactSeats[0].id,
      profile_id: ananya.id,
      stage: 'interview_scheduled',
      proposed_rate: 185000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 90,
      submission_notes: 'Client L1 booked.',
      submitted_by: rec1.id,
      created_at: daysAgo(6),
      updated_at: daysAgo(2),
    },
  });

  const offered = await prisma.submission.create({
    data: {
      requirement_seat_id: devopsSeat.id,
      profile_id: neha.id,
      stage: 'offer',
      proposed_rate: 95000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'USD',
      vendor_rate: 70000,
      vendor_rate_type: 'monthly',
      vendor_rate_currency: 'USD',
      margin: 25000,
      margin_percentage: 26.3,
      offer_date: daysAgo(1),
      offer_ctc: 95000,
      offer_ctc_currency: 'USD',
      expected_joining_date: daysAgo(-20),
      submitted_by: rec2.id,
      created_at: daysAgo(5),
      updated_at: daysAgo(1),
    },
  });

  const closed = await prisma.submission.create({
    data: {
      requirement_seat_id: closedSeat.id,
      profile_id: vikram.id,
      stage: 'closed',
      proposed_rate: 140000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      final_agreed_rate: 135000,
      final_agreed_rate_type: 'monthly',
      offer_date: daysAgo(20),
      actual_joining_date: daysAgo(3),
      bgv_status: 'cleared',
      bgv_initiated_date: daysAgo(18),
      bgv_completed_date: daysAgo(10),
      submitted_by: rec1.id,
      created_at: daysAgo(32),
      updated_at: daysAgo(3),
    },
  });

  // Stuck submission (active stage, updated_at >7 days ago)
  const stuckSubmission = await prisma.submission.create({
    data: {
      requirement_seat_id: stuckSeats[1].id,
      profile_id: rohan.id,
      stage: 'submitted_to_client',
      proposed_rate: 200000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 82,
      submission_notes: 'Waiting on client feedback — aging.',
      submitted_by: rec1.id,
      created_at: daysAgo(16),
      updated_at: daysAgo(12),
    },
  });

  const interviewResult = await prisma.submission.create({
    data: {
      requirement_seat_id: reactSeats[3].id,
      profile_id: priya.id,
      stage: 'interview_result',
      proposed_rate: 170000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 85,
      submission_notes: 'Client L1 completed, awaiting decision.',
      submitted_by: rec2.id,
      created_at: daysAgo(9),
      updated_at: daysAgo(2),
    },
  });

  const inBgv = await prisma.submission.create({
    data: {
      requirement_seat_id: reactSeats[2].id,
      profile_id: karan.id,
      stage: 'bgv',
      proposed_rate: 210000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 91,
      offer_date: daysAgo(14),
      offer_ctc: 2500000,
      offer_ctc_currency: 'INR',
      expected_joining_date: daysAgo(-10),
      bgv_status: 'in_progress',
      bgv_initiated_date: daysAgo(6),
      submitted_by: rec1.id,
      created_at: daysAgo(28),
      updated_at: daysAgo(6),
    },
  });

  const backedOut = await prisma.submission.create({
    data: {
      requirement_seat_id: devopsSeat2.id,
      profile_id: arjun.id,
      stage: 'backout',
      proposed_rate: 90000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'USD',
      relevancy_score: 74,
      submission_notes: 'Candidate backed out after accepting counter-offer elsewhere.',
      submitted_by: rec2.id,
      created_at: daysAgo(45),
      updated_at: daysAgo(38),
    },
  });

  const rejected = await prisma.submission.create({
    data: {
      requirement_seat_id: onHoldSeat.id,
      profile_id: meera.id,
      stage: 'rejected',
      proposed_rate: 120000,
      proposed_rate_type: 'monthly',
      proposed_rate_currency: 'INR',
      relevancy_score: 60,
      submission_notes: 'Client rejected — skills mismatch on data pipelines.',
      submitted_by: rec1.id,
      created_at: daysAgo(210),
      updated_at: daysAgo(200),
    },
  });

  await prisma.interviewRound.createMany({
    data: [
      {
        submission_id: interviewing.id,
        round_number: 1,
        round_type: 'internal',
        round_name: 'Internal screen',
        scheduled_at: daysAgo(4),
        duration_minutes: 45,
        interviewer_name: 'Recruiter One',
        result: 'pass',
        feedback: 'Clear communicator.',
        rating: 4,
        completed_at: daysAgo(4),
      },
      {
        submission_id: interviewing.id,
        round_number: 2,
        round_type: 'client_l1',
        round_name: 'Client L1',
        scheduled_at: daysAgo(-1),
        duration_minutes: 60,
        interviewer_name: 'Priya Client',
        interviewer_email: 'priya@acme.example',
        meeting_link: 'https://meet.example/demo-l1',
        result: 'pending',
      },
      {
        submission_id: closed.id,
        round_number: 1,
        round_type: 'client_final',
        round_name: 'Final',
        scheduled_at: daysAgo(22),
        result: 'pass',
        rating: 5,
        completed_at: daysAgo(22),
      },
      {
        submission_id: interviewResult.id,
        round_number: 1,
        round_type: 'internal',
        round_name: 'Internal screen',
        scheduled_at: daysAgo(9),
        duration_minutes: 30,
        interviewer_name: 'Recruiter Two',
        result: 'pass',
        feedback: 'Solid data engineering fundamentals.',
        rating: 4,
        completed_at: daysAgo(9),
      },
      {
        submission_id: interviewResult.id,
        round_number: 2,
        round_type: 'client_l1',
        round_name: 'Client L1',
        scheduled_at: daysAgo(5),
        duration_minutes: 45,
        interviewer_name: 'Priya Client',
        result: 'no_show',
      },
      {
        submission_id: interviewResult.id,
        round_number: 3,
        round_type: 'client_l1',
        round_name: 'Client L1 (rescheduled)',
        scheduled_at: daysAgo(2),
        duration_minutes: 45,
        interviewer_name: 'Priya Client',
        result: 'rescheduled',
      },
      {
        submission_id: inBgv.id,
        round_number: 1,
        round_type: 'client_l2',
        round_name: 'Client L2',
        scheduled_at: daysAgo(16),
        duration_minutes: 60,
        interviewer_name: 'Priya Client',
        result: 'pass',
        feedback: 'Strong backend design skills, offer recommended.',
        rating: 5,
        completed_at: daysAgo(16),
      },
      {
        submission_id: backedOut.id,
        round_number: 1,
        round_type: 'client_l1',
        round_name: 'Client L1',
        scheduled_at: daysAgo(43),
        result: 'pass',
        completed_at: daysAgo(43),
      },
      {
        submission_id: rejected.id,
        round_number: 1,
        round_type: 'internal',
        round_name: 'Internal screen',
        scheduled_at: daysAgo(208),
        result: 'fail',
        feedback: 'Data pipeline experience below bar for this role.',
        rating: 2,
        completed_at: daysAgo(208),
      },
    ],
  });

  await prisma.stageHistory.createMany({
    data: [
      {
        entity_type: 'submission',
        entity_id: sourced.id,
        from_stage: null,
        to_stage: 'sourced',
        changed_by: rec1.id,
        changed_at: daysAgo(10),
      },
      {
        entity_type: 'submission',
        entity_id: screening.id,
        from_stage: 'sourced',
        to_stage: 'internal_screening',
        changed_by: rec1.id,
        changed_at: daysAgo(4),
      },
      {
        entity_type: 'submission',
        entity_id: interviewing.id,
        from_stage: 'submitted_to_client',
        to_stage: 'interview_scheduled',
        changed_by: rec1.id,
        changed_at: daysAgo(2),
      },
      {
        entity_type: 'submission',
        entity_id: offered.id,
        from_stage: 'interview_result',
        to_stage: 'offer',
        changed_by: rec2.id,
        changed_at: daysAgo(1),
      },
      {
        entity_type: 'submission',
        entity_id: closed.id,
        from_stage: 'bgv',
        to_stage: 'closed',
        changed_by: rec1.id,
        reason: 'Joined',
        changed_at: daysAgo(3),
      },
      {
        entity_type: 'submission',
        entity_id: stuckSubmission.id,
        from_stage: 'internal_screening',
        to_stage: 'submitted_to_client',
        changed_by: rec1.id,
        changed_at: daysAgo(12),
      },
      // Full per-transition history for the new stage examples
      {
        entity_type: 'submission',
        entity_id: interviewResult.id,
        from_stage: null,
        to_stage: 'sourced',
        changed_by: rec2.id,
        changed_at: daysAgo(9),
      },
      {
        entity_type: 'submission',
        entity_id: interviewResult.id,
        from_stage: 'sourced',
        to_stage: 'internal_screening',
        changed_by: rec2.id,
        changed_at: daysAgo(9),
      },
      {
        entity_type: 'submission',
        entity_id: interviewResult.id,
        from_stage: 'internal_screening',
        to_stage: 'submitted_to_client',
        changed_by: rec2.id,
        changed_at: daysAgo(8),
      },
      {
        entity_type: 'submission',
        entity_id: interviewResult.id,
        from_stage: 'submitted_to_client',
        to_stage: 'interview_scheduled',
        changed_by: rec2.id,
        changed_at: daysAgo(6),
      },
      {
        entity_type: 'submission',
        entity_id: interviewResult.id,
        from_stage: 'interview_scheduled',
        to_stage: 'interview_result',
        changed_by: rec2.id,
        changed_at: daysAgo(2),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: null,
        to_stage: 'sourced',
        changed_by: rec1.id,
        changed_at: daysAgo(28),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: 'sourced',
        to_stage: 'internal_screening',
        changed_by: rec1.id,
        changed_at: daysAgo(26),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: 'internal_screening',
        to_stage: 'submitted_to_client',
        changed_by: rec1.id,
        changed_at: daysAgo(22),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: 'submitted_to_client',
        to_stage: 'interview_scheduled',
        changed_by: rec1.id,
        changed_at: daysAgo(18),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: 'interview_scheduled',
        to_stage: 'interview_result',
        changed_by: rec1.id,
        changed_at: daysAgo(16),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: 'interview_result',
        to_stage: 'offer',
        changed_by: rec1.id,
        changed_at: daysAgo(14),
      },
      {
        entity_type: 'submission',
        entity_id: inBgv.id,
        from_stage: 'offer',
        to_stage: 'bgv',
        changed_by: rec1.id,
        changed_at: daysAgo(6),
      },
      {
        entity_type: 'submission',
        entity_id: backedOut.id,
        from_stage: null,
        to_stage: 'sourced',
        changed_by: rec2.id,
        changed_at: daysAgo(45),
      },
      {
        entity_type: 'submission',
        entity_id: backedOut.id,
        from_stage: 'sourced',
        to_stage: 'submitted_to_client',
        changed_by: rec2.id,
        changed_at: daysAgo(44),
      },
      {
        entity_type: 'submission',
        entity_id: backedOut.id,
        from_stage: 'submitted_to_client',
        to_stage: 'offer',
        changed_by: rec2.id,
        changed_at: daysAgo(42),
      },
      {
        entity_type: 'submission',
        entity_id: backedOut.id,
        from_stage: 'offer',
        to_stage: 'backout',
        changed_by: rec2.id,
        reason: 'Candidate accepted a counter-offer from current employer',
        changed_at: daysAgo(38),
      },
      {
        entity_type: 'submission',
        entity_id: rejected.id,
        from_stage: null,
        to_stage: 'sourced',
        changed_by: rec1.id,
        changed_at: daysAgo(210),
      },
      {
        entity_type: 'submission',
        entity_id: rejected.id,
        from_stage: 'sourced',
        to_stage: 'internal_screening',
        changed_by: rec1.id,
        changed_at: daysAgo(209),
      },
      {
        entity_type: 'submission',
        entity_id: rejected.id,
        from_stage: 'internal_screening',
        to_stage: 'rejected',
        changed_by: rec1.id,
        reason: 'Skills mismatch on data pipelines',
        changed_at: daysAgo(200),
      },
    ],
  });

  await prisma.document.createMany({
    data: [
      {
        entity_type: 'profile',
        entity_id: ananya.id,
        label: 'Resume',
        file_url: '/uploads/demo/resume-ananya-sharma.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 184320,
        uploaded_by: rec1.id,
        uploaded_at: daysAgo(12),
      },
      {
        entity_type: 'profile',
        entity_id: rohan.id,
        label: 'Resume',
        file_url: '/uploads/demo/resume-rohan-mehta.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 201984,
        uploaded_by: rec1.id,
        uploaded_at: daysAgo(15),
      },
      {
        entity_type: 'profile',
        entity_id: karan.id,
        label: 'Resume',
        file_url: '/uploads/demo/resume-karan-kapoor.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 176128,
        uploaded_by: rec1.id,
        uploaded_at: daysAgo(250),
      },
      {
        entity_type: 'requirement',
        entity_id: reqs.inProgressReq.id,
        label: 'Job description',
        file_url: '/uploads/demo/jd-react-frontend-engineer.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 92160,
        uploaded_by: rec2.id,
        uploaded_at: daysAgo(9),
      },
      {
        entity_type: 'submission',
        entity_id: closed.id,
        label: 'Offer letter',
        file_url: '/uploads/demo/offer-vikram-das.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 65536,
        uploaded_by: rec1.id,
        uploaded_at: daysAgo(20),
      },
    ],
  });

  await prisma.comment.createMany({
    data: [
      {
        entity_type: 'submission',
        entity_id: interviewing.id,
        user_id: rec1.id,
        body: 'L1 confirmed for tomorrow.',
        created_at: daysAgo(1),
      },
      {
        entity_type: 'requirement',
        entity_id: reqs.inProgressReq.id,
        user_id: users['sales1@delphic.local'].id,
        body: 'Client wants weekly update on Seat 1.',
        created_at: daysAgo(2),
      },
    ],
  });

  return {
    sourced,
    screening,
    interviewing,
    offered,
    closed,
    stuckSubmission,
    interviewResult,
    inBgv,
    backedOut,
    rejected,
  };
}

async function main() {
  console.log('Wiping existing data…');
  await wipeAll();

  const password_hash = await bcrypt.hash('Password123!', 10);
  console.log('Seeding departments…');
  const departments = await seedDepartments();

  console.log('Seeding users…');
  const users = await seedUsers(password_hash, departments);

  console.log('Seeding accounts…');
  const accounts = await seedAccounts(users);

  console.log('Seeding requirements + seats + assignments…');
  const reqs = await seedRequirements(users, accounts);

  console.log('Seeding profiles…');
  const profiles = await seedProfiles(users, accounts);

  console.log('Seeding submissions + interviews + history…');
  await seedSubmissions(users, reqs, profiles);

  const counts = {
    departments: await prisma.department.count(),
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    requirements: await prisma.requirement.count(),
    seats: await prisma.requirementSeat.count(),
    profiles: await prisma.profile.count(),
    submissions: await prisma.submission.count(),
    interview_rounds: await prisma.interviewRound.count(),
    stage_history: await prisma.stageHistory.count(),
    comments: await prisma.comment.count(),
    documents: await prisma.document.count(),
  };

  console.log('Seed complete.');
  console.log(JSON.stringify(counts, null, 2));
  console.log('Login: *@delphic.local / Password123!  (or use one-click login on /login)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
