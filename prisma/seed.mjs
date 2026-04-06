import {
  AssessmentMode,
  AssessmentType,
  AttendanceStatus,
  BatchMode,
  BatchStatus,
  CertificateStatus,
  EnrollmentStatus,
  EvaluationStatus,
  InterviewType,
  PlacementStatus,
  PrismaClient,
  ProgramType,
  SyncStatus,
} from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

import { loadLocalEnv } from "../scripts/load-local-env.mjs";

loadLocalEnv({ preserveKeys: (process.env.PRISMA_PRESERVE_ENV_KEYS ?? "").split(",").filter(Boolean) });

const prisma = new PrismaClient();

const makeUuid = (seed) => `00000000-0000-0000-0000-${seed.toString(16).padStart(12, "0")}`;

const hashPassword = (password) => {
  const normalizedPassword = password.trim();
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(normalizedPassword, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
};

const deriveCodePrefix = (value) => {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "GEN";
  }

  return normalized.slice(0, 3).padEnd(3, "X");
};

const formatEntityCode = (kind, value, sequence) => `${kind}-${deriveCodePrefix(value)}-${String(sequence).padStart(3, "0")}`;

const COURSES = [
  {
    name: "Language Career Track",
    description: "Language preparation pathways for international academy placement.",
    type: ProgramType.LANGUAGE,
  },
  {
    name: "Clinical Career Track",
    description: "Clinical upskilling pathways for nursing and healthcare deployment.",
    type: ProgramType.CLINICAL,
  },
  {
    name: "Technical Career Track",
    description: "Technical programs aligned with healthcare operations and IT roles.",
    type: ProgramType.TECHNICAL,
  },
];

const PROGRAMS = [
  { slug: "german-language-b1", name: "German Language B1", type: ProgramType.LANGUAGE, category: "Language", durationWeeks: 20 },
  { slug: "german-language-b2", name: "German Language B2", type: ProgramType.LANGUAGE, category: "Language", durationWeeks: 22 },
  { slug: "ielts-academic-fast-track", name: "IELTS Academic Fast Track", type: ProgramType.LANGUAGE, category: "Language", durationWeeks: 12 },
  { slug: "clinical-bridging", name: "Clinical Bridging", type: ProgramType.CLINICAL, category: "Clinical", durationWeeks: 16 },
  { slug: "nclex-prep-bootcamp", name: "NCLEX Prep Bootcamp", type: ProgramType.CLINICAL, category: "Clinical", durationWeeks: 14 },
  { slug: "osce-lab-readiness", name: "OSCE Lab Readiness", type: ProgramType.CLINICAL, category: "Clinical", durationWeeks: 10 },
  { slug: "healthcare-it-fundamentals", name: "Healthcare IT Fundamentals", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 12 },
  { slug: "medical-billing-rcm", name: "Medical Billing and RCM", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 11 },
  { slug: "ehr-data-quality", name: "EHR Data Quality", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 9 },
  { slug: "clinical-data-coordinator", name: "Clinical Data Coordinator", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 13 },
];

const TRAINERS = [
  { name: "Dr. Markus Stein", email: "markus.trainer@gts-academy.test", phone: "+91-9000000002", specialization: "German Language", rating: 4.8 },
  { name: "Ms. Leena Pillai", email: "leena.trainer@gts-academy.test", phone: "+91-9000000003", specialization: "Clinical Communication", rating: 4.6 },
  { name: "Mr. Rahul Menon", email: "rahul.trainer@gts-academy.test", phone: "+91-9000000004", specialization: "NCLEX Strategy", rating: 4.5 },
  { name: "Dr. Sarah Jacob", email: "sarah.trainer@gts-academy.test", phone: "+91-9000000005", specialization: "OSCE Simulation", rating: 4.7 },
  { name: "Mr. Ajay Thomas", email: "ajay.trainer@gts-academy.test", phone: "+91-9000000006", specialization: "Healthcare IT", rating: 4.4 },
  { name: "Ms. Neha Varma", email: "neha.trainer@gts-academy.test", phone: "+91-9000000007", specialization: "Medical Coding", rating: 4.5 },
  { name: "Mr. Johan Roy", email: "johan.trainer@gts-academy.test", phone: "+91-9000000008", specialization: "Data Quality", rating: 4.3 },
  { name: "Ms. Priya Nair", email: "priya.trainer@gts-academy.test", phone: "+91-9000000009", specialization: "Interview Readiness", rating: 4.6 },
];

const FIRST_NAMES = [
  "Aditya", "Meera", "Arjun", "Neha", "Rahul", "Priya", "Asha", "Kiran", "Vikram", "Anita",
  "Rohan", "Nisha", "Sandeep", "Divya", "Manoj", "Kavya", "Ravi", "Pooja", "Amit", "Sneha",
  "Varun", "Isha", "Deepak", "Anu", "Harish", "Swathi", "Nitin", "Lakshmi", "Yash", "Maya",
  "Gokul", "Riya", "Suresh", "Anjali", "Tarun", "Shreya", "Karthik", "Minal", "Dev", "Bhavana",
  "Arav", "Keerthi", "Ritesh", "Nandini", "Vivek", "Amritha", "Sai", "Pallavi", "Kunal", "Irene",
];

const LAST_NAMES = [
  "Sharma", "Nair", "Mehta", "Verma", "Reddy", "Thomas", "Pillai", "Menon", "Roy", "Iyer",
  "Singh", "Patel", "Das", "Mishra", "Khan", "Joshi", "Kapoor", "Bose", "Mathew", "George",
  "Yadav", "Chandra", "Kumar", "Fernandes", "Prasad", "Saxena", "Paul", "Rao", "Bhat", "Pandey",
  "Jain", "Banerjee", "Nanda", "Sethi", "Kulkarni", "Agarwal", "Malhotra", "Dutta", "Srinivasan", "Tripathi",
  "Chopra", "Bhatt", "Shetty", "Ghosh", "Kohli", "Rastogi", "Tiwari", "Lal", "Nambiar", "Raman",
];

const SYSTEM_ROLES = [
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Full access to all modules and actions" },
  { code: "ACADEMY_ADMIN", name: "Academy Admin", description: "Manage learners, courses, programs, batches, trainers, assessments" },
  { code: "TRAINER", name: "Trainer", description: "Schedule, attendance, assessments within assigned context" },
  { code: "CONTENT_MANAGER", name: "Content Manager", description: "Courses, programs, LMS, email templates" },
  { code: "SUPPORT_USER", name: "Support User", description: "Support tickets, learner view-only" },
  { code: "CANDIDATE", name: "Candidate", description: "Candidate app access (no admin portal permissions)" },
];

const PERMISSION_DEFINITIONS = [
  { module: "dashboard", action: "view", key: "dashboard.view", description: "View dashboard" },
  { module: "users", action: "view", key: "users.view", description: "View learners/users" },
  { module: "users", action: "create", key: "users.create", description: "Create learners/users" },
  { module: "users", action: "edit", key: "users.edit", description: "Edit learners/users" },
  { module: "users", action: "delete", key: "users.delete", description: "Delete learners/users" },
  { module: "staff_users", action: "view", key: "staff_users.view", description: "View internal users" },
  { module: "staff_users", action: "create", key: "staff_users.create", description: "Create internal users" },
  { module: "staff_users", action: "edit", key: "staff_users.edit", description: "Edit internal users" },
  { module: "staff_users", action: "delete", key: "staff_users.delete", description: "Deactivate internal users" },
  { module: "auth", action: "login", key: "auth.login", description: "Sign in to the academy admin portal" },
  { module: "auth", action: "manage", key: "auth.manage", description: "Manage authentication and account recovery" },
  { module: "sessions", action: "view", key: "sessions.view", description: "View active sessions" },
  { module: "sessions", action: "manage", key: "sessions.manage", description: "Manage active sessions and logout all devices" },
  { module: "courses", action: "view", key: "courses.view", description: "View courses" },
  { module: "courses", action: "create", key: "courses.create", description: "Create courses" },
  { module: "courses", action: "edit", key: "courses.edit", description: "Edit courses" },
  { module: "courses", action: "delete", key: "courses.delete", description: "Delete courses" },
  { module: "programs", action: "view", key: "programs.view", description: "View programs" },
  { module: "programs", action: "create", key: "programs.create", description: "Create programs" },
  { module: "programs", action: "edit", key: "programs.edit", description: "Edit programs" },
  { module: "programs", action: "delete", key: "programs.delete", description: "Delete programs" },
  { module: "batches", action: "view", key: "batches.view", description: "View batches" },
  { module: "batches", action: "create", key: "batches.create", description: "Create batches" },
  { module: "batches", action: "edit", key: "batches.edit", description: "Edit batches" },
  { module: "batches", action: "delete", key: "batches.delete", description: "Delete batches" },
  { module: "trainers", action: "view", key: "trainers.view", description: "View trainers" },
  { module: "trainers", action: "create", key: "trainers.create", description: "Create trainers" },
  { module: "trainers", action: "edit", key: "trainers.edit", description: "Edit trainers" },
  { module: "trainers", action: "delete", key: "trainers.delete", description: "Delete trainers" },
  { module: "trainers", action: "manage", key: "trainers.manage", description: "Manage trainer assignments" },
  { module: "schedule", action: "view", key: "schedule.view", description: "View schedule" },
  { module: "schedule", action: "create", key: "schedule.create", description: "Create schedule events" },
  { module: "schedule", action: "edit", key: "schedule.edit", description: "Edit schedule events" },
  { module: "schedule", action: "delete", key: "schedule.delete", description: "Delete schedule events" },
  { module: "attendance", action: "view", key: "attendance.view", description: "View attendance" },
  { module: "attendance", action: "manage", key: "attendance.manage", description: "Mark/manage attendance" },
  { module: "assessments", action: "view", key: "assessments.view", description: "View assessments" },
  { module: "assessments", action: "create", key: "assessments.create", description: "Create assessments" },
  { module: "assessments", action: "edit", key: "assessments.edit", description: "Edit assessments" },
  { module: "assessments", action: "delete", key: "assessments.delete", description: "Delete assessments" },
  { module: "assessments", action: "publish", key: "assessments.publish", description: "Publish assessments" },
  { module: "certifications", action: "view", key: "certifications.view", description: "View certifications" },
  { module: "certifications", action: "create", key: "certifications.create", description: "Create certifications" },
  { module: "certifications", action: "edit", key: "certifications.edit", description: "Edit certifications" },
  { module: "certifications", action: "delete", key: "certifications.delete", description: "Delete certifications" },
  { module: "readiness", action: "view", key: "readiness.view", description: "View readiness" },
  { module: "readiness", action: "manage", key: "readiness.manage", description: "Manage readiness/sync" },
  { module: "lms", action: "view", key: "lms.view", description: "View LMS content" },
  { module: "lms", action: "create", key: "lms.create", description: "Create LMS content" },
  { module: "lms", action: "edit", key: "lms.edit", description: "Edit LMS content" },
  { module: "lms", action: "manage", key: "lms.manage", description: "Manage LMS settings" },
  { module: "quizzes", action: "view", key: "quizzes.view", description: "View quizzes" },
  { module: "quizzes", action: "create", key: "quizzes.create", description: "Create quizzes" },
  { module: "quizzes", action: "edit", key: "quizzes.edit", description: "Edit quizzes" },
  { module: "quizzes", action: "delete", key: "quizzes.delete", description: "Delete quizzes" },
  { module: "quizzes", action: "publish", key: "quizzes.publish", description: "Publish quizzes" },
  { module: "payments", action: "view", key: "payments.view", description: "View payments" },
  { module: "payments", action: "manage", key: "payments.manage", description: "Manage payments" },
  { module: "support", action: "view", key: "support.view", description: "View support tickets" },
  { module: "support", action: "manage", key: "support.manage", description: "Manage support tickets" },
  { module: "logs", action: "view", key: "logs.view", description: "View logs and actions" },
  { module: "settings", action: "view", key: "settings.view", description: "View settings" },
  { module: "settings", action: "edit", key: "settings.edit", description: "Edit settings" },
  { module: "email_templates", action: "view", key: "email_templates.view", description: "View email templates" },
  { module: "email_templates", action: "create", key: "email_templates.create", description: "Create email templates" },
  { module: "email_templates", action: "edit", key: "email_templates.edit", description: "Edit email templates" },
  { module: "email_templates", action: "delete", key: "email_templates.delete", description: "Delete email templates" },
  { module: "roles", action: "view", key: "roles.view", description: "View roles and permissions" },
  { module: "roles", action: "create", key: "roles.create", description: "Create roles" },
  { module: "roles", action: "edit", key: "roles.edit", description: "Edit roles and permission assignments" },
  { module: "roles", action: "delete", key: "roles.delete", description: "Delete roles" },
];

// SUPER_ADMIN gets implicit bypass in code — no explicit permissions needed.
// CANDIDATE gets no admin portal permissions.
const ROLE_PERMISSION_MAP = {
  ACADEMY_ADMIN: [
    "dashboard.view",
    "auth.login", "auth.manage",
    "sessions.view", "sessions.manage",
    "users.view", "users.create", "users.edit", "users.delete",
    "staff_users.view", "staff_users.create", "staff_users.edit", "staff_users.delete",
    "courses.view", "courses.create", "courses.edit", "courses.delete",
    "programs.view", "programs.create", "programs.edit", "programs.delete",
    "batches.view", "batches.create", "batches.edit", "batches.delete",
    "trainers.view", "trainers.create", "trainers.edit", "trainers.delete", "trainers.manage",
    "schedule.view", "schedule.create", "schedule.edit", "schedule.delete",
    "attendance.view", "attendance.manage",
    "assessments.view", "assessments.create", "assessments.edit", "assessments.delete", "assessments.publish",
    "certifications.view", "certifications.create", "certifications.edit", "certifications.delete",
    "readiness.view", "readiness.manage",
    "lms.view", "lms.create", "lms.edit", "lms.manage",
    "quizzes.view", "quizzes.create", "quizzes.edit", "quizzes.delete", "quizzes.publish",
    "payments.view", "payments.manage",
    "support.view", "support.manage",
    "logs.view",
    "settings.edit",
    "email_templates.view", "email_templates.edit",
  ],
  TRAINER: [
    "dashboard.view",
    "auth.login",
    "sessions.view", "sessions.manage",
    "courses.view",
    "programs.view",
    "batches.view",
    "trainers.view",
    "schedule.view", "schedule.create", "schedule.edit", "schedule.delete",
    "attendance.view", "attendance.manage",
    "assessments.view", "assessments.create", "assessments.edit",
    "certifications.view",
    "readiness.view",
    "lms.view",
    "quizzes.view", "quizzes.create", "quizzes.edit",
  ],
  CONTENT_MANAGER: [
    "dashboard.view",
    "auth.login",
    "sessions.view", "sessions.manage",
    "courses.view", "courses.create", "courses.edit", "courses.delete",
    "programs.view", "programs.create", "programs.edit", "programs.delete",
    "assessments.view",
    "lms.view", "lms.create", "lms.edit", "lms.manage",
    "quizzes.view", "quizzes.create", "quizzes.edit", "quizzes.delete", "quizzes.publish",
    "email_templates.view", "email_templates.create", "email_templates.edit", "email_templates.delete",
  ],
  SUPPORT_USER: [
    "dashboard.view",
    "auth.login",
    "sessions.view", "sessions.manage",
    "users.view",
    "support.view", "support.manage",
  ],
};

async function upsertUser({ email, name, phone, password }) {
  const hashedPassword = hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    update: { name, phone, password: hashedPassword, isActive: true },
    create: { email, name, phone, password: hashedPassword, isActive: true, metadata: {} },
  });
}

async function assignUserRole(userId, roleId) {
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

function placementForIndex(index) {
  if (index < 5) {
    return {
      placementStatus: PlacementStatus.PLACEMENT_READY,
      syncStatus: index < 3 ? SyncStatus.SYNCED : SyncStatus.NOT_SYNCED,
      isReadyForDeployment: true,
      readiness: 86 + (index % 5),
    };
  }

  if (index % 3 === 0) {
    return {
      placementStatus: PlacementStatus.IN_REVIEW,
      syncStatus: SyncStatus.NOT_SYNCED,
      isReadyForDeployment: false,
      readiness: 72 + (index % 8),
    };
  }

  return {
    placementStatus: PlacementStatus.NOT_READY,
    syncStatus: SyncStatus.NOT_SYNCED,
    isReadyForDeployment: false,
    readiness: 58 + (index % 10),
  };
}

async function seed() {
  // --- Seed RBAC: Roles ---
  const roleRecords = {};
  for (const roleDef of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description, isSystemRole: true, isActive: true },
      create: { name: roleDef.name, code: roleDef.code, description: roleDef.description, isSystemRole: true, isActive: true },
    });
    roleRecords[roleDef.code] = role;
  }

  // --- Seed RBAC: Permissions ---
  const permissionRecords = {};
  for (const permDef of PERMISSION_DEFINITIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: permDef.key },
      update: { module: permDef.module, action: permDef.action, description: permDef.description },
      create: { module: permDef.module, action: permDef.action, key: permDef.key, description: permDef.description },
    });
    permissionRecords[permDef.key] = perm;
  }

  // --- Seed RBAC: Role-Permission matrix ---
  for (const [roleCode, permKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = roleRecords[roleCode];
    for (const permKey of permKeys) {
      const perm = permissionRecords[permKey];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // --- Seed admin user ---
  const adminUser = await upsertUser({
    email: "arjakroy2411@gmail.com",
    name: "Academy Admin",
    phone: "+91-9000000001",
    password: "dev-password",
  });
  await assignUserRole(adminUser.id, roleRecords.SUPER_ADMIN.id);

  // --- Seed additional test users for each role ---
  const academyAdminUser = await upsertUser({
    email: "academyadmin@gts-academy.test",
    name: "Academy Admin User",
    phone: "+91-9000000050",
    password: "dev-password",
  });
  await assignUserRole(academyAdminUser.id, roleRecords.ACADEMY_ADMIN.id);

  const contentMgrUser = await upsertUser({
    email: "contentmgr@gts-academy.test",
    name: "Content Manager",
    phone: "+91-9000000051",
    password: "dev-password",
  });
  await assignUserRole(contentMgrUser.id, roleRecords.CONTENT_MANAGER.id);

  const supportUser = await upsertUser({
    email: "supportuser@gts-academy.test",
    name: "Support User",
    phone: "+91-9000000052",
    password: "dev-password",
  });
  await assignUserRole(supportUser.id, roleRecords.SUPPORT_USER.id);

  await prisma.currency.upsert({ where: { code: "INR" }, update: { symbol: "Rs" }, create: { code: "INR", symbol: "Rs" } });

  const india = await prisma.country.upsert({
    where: { isoCode: "IN" },
    update: { name: "India" },
    create: { name: "India", isoCode: "IN" },
  });

  const kerala = await prisma.state.upsert({
    where: { id: 1 },
    update: { name: "Kerala", countryId: india.id },
    create: { id: 1, name: "Kerala", countryId: india.id },
  });

  const kochi = await prisma.city.upsert({
    where: { id: 1 },
    update: { name: "Kochi", stateId: kerala.id },
    create: { id: 1, name: "Kochi", stateId: kerala.id },
  });

  const centre = await prisma.trainingCentre.upsert({
    where: { id: makeUuid(9001) },
    update: {
      name: "GTS Main Campus",
      locationId: kochi.id,
      totalCapacity: 300,
      currentUtilization: 180,
      complianceStatus: "compliant",
      infrastructure: { labs: 6, classrooms: 12 },
      isActive: true,
    },
    create: {
      id: makeUuid(9001),
      name: "GTS Main Campus",
      locationId: kochi.id,
      totalCapacity: 300,
      currentUtilization: 180,
      complianceStatus: "compliant",
      infrastructure: { labs: 6, classrooms: 12 },
      isActive: true,
    },
  });

  const courseRecords = [];
  for (const course of COURSES) {
    const courseSequence = courseRecords.filter((record) => deriveCodePrefix(record.name) === deriveCodePrefix(course.name)).length + 1;
    const record = await prisma.course.upsert({
      where: { name: course.name },
      update: {
        code: formatEntityCode("C", course.name, courseSequence),
        description: course.description,
        isActive: true,
      },
      create: {
        code: formatEntityCode("C", course.name, courseSequence),
        name: course.name,
        description: course.description,
        isActive: true,
      },
    });

    courseRecords.push(record);
  }

  const courseByType = new Map(courseRecords.map((course, index) => [COURSES[index].type, course]));

  const programRecords = [];
  for (const program of PROGRAMS) {
    const mappedCourse = courseByType.get(program.type);
    if (!mappedCourse) {
      throw new Error(`Missing seeded course for program type ${program.type}.`);
    }

    const programSequence = programRecords.filter((record) => deriveCodePrefix(record.name) === deriveCodePrefix(program.name)).length + 1;

    const record = await prisma.program.upsert({
      where: { slug: program.slug },
      update: {
        courseId: mappedCourse.id,
        code: formatEntityCode("P", program.name, programSequence),
        name: program.name,
        type: program.type,
        category: program.category,
        description: `${program.name} curriculum for academy deployment readiness.`,
        durationWeeks: program.durationWeeks,
        isActive: true,
      },
      create: {
        courseId: mappedCourse.id,
        code: formatEntityCode("P", program.name, programSequence),
        slug: program.slug,
        name: program.name,
        type: program.type,
        category: program.category,
        description: `${program.name} curriculum for academy deployment readiness.`,
        durationWeeks: program.durationWeeks,
        isActive: true,
      },
    });

    programRecords.push(record);
  }

  const trainerRecords = [];
  for (let i = 0; i < TRAINERS.length; i += 1) {
    const profile = TRAINERS[i];
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      password: "dev-password",
    });
    await assignUserRole(user.id, roleRecords.TRAINER.id);

    const assignedPrograms = [programRecords[i % programRecords.length].name, programRecords[(i + 3) % programRecords.length].name];

    const trainer = await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      update: {
        specialization: profile.specialization,
        bio: `${profile.specialization} trainer focused on measurable outcomes.`,
        rating: profile.rating,
        capacity: 4,
        isActive: true,
        programs: assignedPrograms,
      },
      create: {
        userId: user.id,
        specialization: profile.specialization,
        bio: `${profile.specialization} trainer focused on measurable outcomes.`,
        rating: profile.rating,
        capacity: 4,
        isActive: true,
        programs: assignedPrograms,
      },
    });

    trainerRecords.push(trainer);
  }

  const batchRecords = [];
  for (let i = 0; i < programRecords.length; i += 1) {
    const program = programRecords[i];
    const eligibleTrainers = trainerRecords.filter((trainer) =>
      Array.isArray(trainer.programs) && trainer.programs.includes(program.name)
    );

    const primaryTrainer = eligibleTrainers[0] ?? trainerRecords[i % trainerRecords.length];
    const connectedTrainers = eligibleTrainers.length > 0 ? eligibleTrainers.slice(0, 2) : [primaryTrainer];
    const prefix = program.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
    const code = `B-${prefix}-${String(i + 1).padStart(3, "0")}`;

    const batch = await prisma.batch.upsert({
      where: { code },
      update: {
        name: `${program.name} Cohort ${i + 1}`,
        programId: program.id,
        centreId: centre.id,
        trainerId: primaryTrainer.id,
        trainers: { set: connectedTrainers.map((trainer) => ({ id: trainer.id })) },
        campus: i % 2 === 0 ? "Main Campus" : "North Wing",
        startDate: new Date(Date.UTC(2026, i % 6, 1 + (i % 4))),
        endDate: new Date(Date.UTC(2026, (i % 6) + 4, 15)),
        mode: i % 3 === 0 ? BatchMode.ONLINE : BatchMode.OFFLINE,
        status: i % 4 === 0 ? BatchStatus.PLANNED : BatchStatus.IN_SESSION,
        capacity: 25 + (i % 5) * 5,
        schedule: ["MON", "WED", "FRI"],
      },
      create: {
        code,
        name: `${program.name} Cohort ${i + 1}`,
        programId: program.id,
        centreId: centre.id,
        trainerId: primaryTrainer.id,
        trainers: { connect: connectedTrainers.map((trainer) => ({ id: trainer.id })) },
        campus: i % 2 === 0 ? "Main Campus" : "North Wing",
        startDate: new Date(Date.UTC(2026, i % 6, 1 + (i % 4))),
        endDate: new Date(Date.UTC(2026, (i % 6) + 4, 15)),
        mode: i % 3 === 0 ? BatchMode.ONLINE : BatchMode.OFFLINE,
        status: i % 4 === 0 ? BatchStatus.PLANNED : BatchStatus.IN_SESSION,
        capacity: 25 + (i % 5) * 5,
        schedule: ["MON", "WED", "FRI"],
      },
    });

    batchRecords.push(batch);
  }

  const defaultRule =
    (await prisma.readinessEngineRule.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.readinessEngineRule.create({
      data: {
        name: "default",
        attendanceWeight: 30,
        assessmentWeight: 50,
        softSkillsWeight: 20,
        placementThreshold: 80,
        isDefault: true,
      },
    }));

  const learnerRecords = [];
  for (let i = 0; i < 50; i += 1) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const learnerCode = `GTS-${String(240901 + i)}`;
    const placement = placementForIndex(i);
    const attendance = 70 + (i % 30);
    const assessment = 65 + (i % 30);

    const learner = await prisma.learner.upsert({
      where: { learnerCode },
      update: {
        fullName,
        email: `learner${String(i + 1).padStart(2, "0")}@gts-academy.test`,
        phone: `+91-98${String(70000000 + i).slice(-8)}`,
        country: "India",
        softSkillsScore: 60 + (i % 35),
        readinessPercentage: placement.readiness,
        placementStatus: placement.placementStatus,
        recruiterSyncStatus: placement.syncStatus,
        latestAssessmentAverage: assessment,
        latestAttendancePercentage: attendance,
        isReadyForDeployment: placement.isReadyForDeployment,
      },
      create: {
        learnerCode,
        fullName,
        email: `learner${String(i + 1).padStart(2, "0")}@gts-academy.test`,
        phone: `+91-98${String(70000000 + i).slice(-8)}`,
        country: "India",
        softSkillsScore: 60 + (i % 35),
        readinessPercentage: placement.readiness,
        placementStatus: placement.placementStatus,
        recruiterSyncStatus: placement.syncStatus,
        latestAssessmentAverage: assessment,
        latestAttendancePercentage: attendance,
        isReadyForDeployment: placement.isReadyForDeployment,
      },
    });

    learnerRecords.push(learner);

    const batch = batchRecords[i % batchRecords.length];
    const enrollment = await prisma.batchEnrollment.upsert({
      where: { learnerId_batchId: { learnerId: learner.id, batchId: batch.id } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { learnerId: learner.id, batchId: batch.id, status: EnrollmentStatus.ACTIVE },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_sessionDate: {
          enrollmentId: enrollment.id,
          sessionDate: new Date("2026-03-28"),
        },
      },
      update: {
        status: i % 7 === 0 ? AttendanceStatus.LATE : i % 11 === 0 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
        markedById: adminUser.id,
        notes: "Seeded attendance record",
      },
      create: {
        enrollmentId: enrollment.id,
        sessionDate: new Date("2026-03-28"),
        status: i % 7 === 0 ? AttendanceStatus.LATE : i % 11 === 0 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
        markedById: adminUser.id,
        notes: "Seeded attendance record",
      },
    });

    await prisma.candidateBasicDetails.upsert({
      where: { candidateId: learner.id },
      update: {
        passportNo: `P${String(100000 + i)}`,
        education: { highest: "BSc Nursing" },
        experience: { years: i % 5 },
      },
      create: {
        candidateId: learner.id,
        passportNo: `P${String(100000 + i)}`,
        education: { highest: "BSc Nursing" },
        experience: { years: i % 5 },
      },
    });

    await prisma.candidateDocument.upsert({
      where: { id: makeUuid(11000 + i) },
      update: {
        candidateId: learner.id,
        documentType: "PASSPORT",
        filePath: `/seed-docs/${learnerCode}-passport.pdf`,
        verified: i % 4 !== 0,
      },
      create: {
        id: makeUuid(11000 + i),
        candidateId: learner.id,
        documentType: "PASSPORT",
        filePath: `/seed-docs/${learnerCode}-passport.pdf`,
        verified: i % 4 !== 0,
      },
    });

    await prisma.readinessSnapshot.upsert({
      where: { id: makeUuid(12000 + i) },
      update: {
        learnerId: learner.id,
        ruleId: defaultRule.id,
        percentage: placement.readiness,
        status: placement.placementStatus,
        syncStatus: placement.syncStatus,
        syncedAt: placement.syncStatus === SyncStatus.SYNCED ? new Date("2026-03-29T10:30:00Z") : null,
        notes: "Seeded readiness snapshot",
      },
      create: {
        id: makeUuid(12000 + i),
        learnerId: learner.id,
        ruleId: defaultRule.id,
        percentage: placement.readiness,
        status: placement.placementStatus,
        syncStatus: placement.syncStatus,
        syncedAt: placement.syncStatus === SyncStatus.SYNCED ? new Date("2026-03-29T10:30:00Z") : null,
        notes: "Seeded readiness snapshot",
      },
    });

    if (placement.isReadyForDeployment) {
      await prisma.recruiterSyncLog.upsert({
        where: { id: makeUuid(13000 + i) },
        update: {
          learnerId: learner.id,
          triggeredById: adminUser.id,
          destination: "recruiter-workspace",
          status: placement.syncStatus,
          payload: { learnerCode, readinessPercentage: placement.readiness },
          responseBody: placement.syncStatus === SyncStatus.SYNCED ? { accepted: true } : { accepted: false },
          message: "Seeded recruiter sync log",
        },
        create: {
          id: makeUuid(13000 + i),
          learnerId: learner.id,
          triggeredById: adminUser.id,
          destination: "recruiter-workspace",
          status: placement.syncStatus,
          payload: { learnerCode, readinessPercentage: placement.readiness },
          responseBody: placement.syncStatus === SyncStatus.SYNCED ? { accepted: true } : { accepted: false },
          message: "Seeded recruiter sync log",
        },
      });

      await prisma.certificate.upsert({
        where: { verificationCode: `CERT-${learnerCode}` },
        update: {
          learnerId: learner.id,
          programId: batch.programId,
          status: CertificateStatus.ISSUED,
        },
        create: {
          learnerId: learner.id,
          programId: batch.programId,
          status: CertificateStatus.ISSUED,
          verificationCode: `CERT-${learnerCode}`,
        },
      });
    }

    await prisma.performanceMetric.upsert({
      where: { id: makeUuid(14000 + i) },
      update: {
        learnerId: learner.id,
        batchId: batch.id,
        gameScore: 55 + (i % 35),
        attendancePercentage: attendance,
        readingScore: 60 + (i % 30),
        writingScore: 58 + (i % 35),
        listeningScore: 61 + (i % 28),
        speakingScore: 62 + (i % 27),
        overallBand: (65 + (i % 25)) / 10,
        trainerFeedback: "Seeded performance metric",
      },
      create: {
        id: makeUuid(14000 + i),
        learnerId: learner.id,
        batchId: batch.id,
        gameScore: 55 + (i % 35),
        attendancePercentage: attendance,
        readingScore: 60 + (i % 30),
        writingScore: 58 + (i % 35),
        listeningScore: 61 + (i % 28),
        speakingScore: 62 + (i % 27),
        overallBand: (65 + (i % 25)) / 10,
        trainerFeedback: "Seeded performance metric",
      },
    });

    await prisma.roleplay.upsert({
      where: { id: makeUuid(15000 + i) },
      update: {
        batchId: batch.id,
        learnerId: learner.id,
        trainerId: trainerRecords[i % trainerRecords.length].id,
        scenarioName: "Patient handoff communication",
        videoUrl: `https://seed.local/roleplays/${learnerCode}`,
        scores: { communication: 80, empathy: 78, accuracy: 82 },
      },
      create: {
        id: makeUuid(15000 + i),
        batchId: batch.id,
        learnerId: learner.id,
        trainerId: trainerRecords[i % trainerRecords.length].id,
        scenarioName: "Patient handoff communication",
        videoUrl: `https://seed.local/roleplays/${learnerCode}`,
        scores: { communication: 80, empathy: 78, accuracy: 82 },
      },
    });

    await prisma.interview.upsert({
      where: { id: makeUuid(16000 + i) },
      update: {
        learnerId: learner.id,
        interviewerId: adminUser.id,
        type: i % 2 === 0 ? InterviewType.INTERNAL_MOCK : InterviewType.LANGUAGE_CHECK,
        status: i % 5 === 0 ? EvaluationStatus.COMPLETED : EvaluationStatus.SCHEDULED,
        scheduledAt: new Date(Date.UTC(2026, 4, 1 + (i % 20), 10, 0, 0)),
        feedbackSummary: "Seeded interview record",
        isPassed: i < 5,
      },
      create: {
        id: makeUuid(16000 + i),
        learnerId: learner.id,
        interviewerId: adminUser.id,
        type: i % 2 === 0 ? InterviewType.INTERNAL_MOCK : InterviewType.LANGUAGE_CHECK,
        status: i % 5 === 0 ? EvaluationStatus.COMPLETED : EvaluationStatus.SCHEDULED,
        scheduledAt: new Date(Date.UTC(2026, 4, 1 + (i % 20), 10, 0, 0)),
        feedbackSummary: "Seeded interview record",
        isPassed: i < 5,
      },
    });
  }

  const assessmentRecords = [];
  for (let i = 0; i < batchRecords.length; i += 1) {
    const batch = batchRecords[i];
    const program = programRecords.find((item) => item.id === batch.programId);
    const assessment = await prisma.assessment.upsert({
      where: { id: makeUuid(17000 + i) },
      update: {
        title: `${program?.name ?? "Program"} Assessment ${i + 1}`,
        type: i % 3 === 0 ? AssessmentType.FINAL : AssessmentType.MODULE,
        mode: i % 2 === 0 ? AssessmentMode.ONLINE : AssessmentMode.VIVA_VOCE,
        maxScore: 100,
        programId: batch.programId,
        batchId: batch.id,
        status: EvaluationStatus.COMPLETED,
        scheduledAt: new Date(Date.UTC(2026, 2, 10 + i, 9, 0, 0)),
      },
      create: {
        id: makeUuid(17000 + i),
        title: `${program?.name ?? "Program"} Assessment ${i + 1}`,
        type: i % 3 === 0 ? AssessmentType.FINAL : AssessmentType.MODULE,
        mode: i % 2 === 0 ? AssessmentMode.ONLINE : AssessmentMode.VIVA_VOCE,
        maxScore: 100,
        programId: batch.programId,
        batchId: batch.id,
        status: EvaluationStatus.COMPLETED,
        scheduledAt: new Date(Date.UTC(2026, 2, 10 + i, 9, 0, 0)),
      },
    });

    assessmentRecords.push(assessment);
  }

  for (let i = 0; i < learnerRecords.length; i += 1) {
    const learner = learnerRecords[i];
    const assessment = assessmentRecords[i % assessmentRecords.length];
    const scoreValue = 62 + (i % 35);

    await prisma.assessmentScore.upsert({
      where: { assessmentId_learnerId: { assessmentId: assessment.id, learnerId: learner.id } },
      update: {
        score: scoreValue,
        feedback: "Seeded assessment score",
      },
      create: {
        assessmentId: assessment.id,
        learnerId: learner.id,
        score: scoreValue,
        feedback: "Seeded assessment score",
      },
    });
  }

  for (let i = 0; i < trainerRecords.length; i += 1) {
    const trainer = trainerRecords[i];
    const batch = batchRecords[i % batchRecords.length];

    await prisma.trainerPmsLog.upsert({
      where: { id: makeUuid(18000 + i) },
      update: {
        trainerId: trainer.id,
        batchId: batch.id,
        studentFeedbackAvg: 4.1 + (i % 6) * 0.1,
        completionRate: 82 + i,
        pmsScoreCalculated: 78 + i,
      },
      create: {
        id: makeUuid(18000 + i),
        trainerId: trainer.id,
        batchId: batch.id,
        studentFeedbackAvg: 4.1 + (i % 6) * 0.1,
        completionRate: 82 + i,
        pmsScoreCalculated: 78 + i,
      },
    });
  }

  const readyCount = await prisma.learner.count({ where: { placementStatus: PlacementStatus.PLACEMENT_READY } });

  console.log("Seed complete", {
    roles: Object.keys(roleRecords).length,
    permissions: Object.keys(permissionRecords).length,
    programs: programRecords.length,
    trainers: trainerRecords.length,
    learners: learnerRecords.length,
    placementReadyLearners: readyCount,
    batches: batchRecords.length,
  });
}

seed()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
