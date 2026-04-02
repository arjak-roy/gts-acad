import { randomBytes, scryptSync } from "node:crypto";

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
  UserRole,
} from "@prisma/client";

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

const RBAC_ROLES = [
  {
    name: "Super Admin",
    description: "Full unrestricted access across all resources.",
    isSystem: true,
  },
  {
    name: "Admin",
    description: "Administrative access with scoped system and candidate permissions.",
    isSystem: true,
  },
  {
    name: "Candidate",
    description: "End-user access limited to self-service actions.",
    isSystem: true,
  },
];

const RBAC_PERMISSIONS = [
  {
    name: "all:*",
    resource: "all",
    action: "*",
    description: "Master permission granting unrestricted access to all resources and actions.",
  },
  {
    name: "candidate:read_own",
    resource: "candidate",
    action: "read_own",
    description: "Read the authenticated candidate profile and related records.",
  },
  {
    name: "candidate:update_own",
    resource: "candidate",
    action: "update_own",
    description: "Update the authenticated candidate profile.",
  },
  {
    name: "module:dashboard",
    resource: "module",
    action: "dashboard",
    description: "Access dashboard KPIs, alerts, and search.",
  },
  {
    name: "module:overview",
    resource: "module",
    action: "overview",
    description: "Access cross-module overview pages.",
  },
  {
    name: "module:learners",
    resource: "module",
    action: "learners",
    description: "Access learner management pages and APIs.",
  },
  {
    name: "module:courses",
    resource: "module",
    action: "courses",
    description: "Access courses module.",
  },
  {
    name: "module:programs",
    resource: "module",
    action: "programs",
    description: "Access programs module.",
  },
  {
    name: "module:batches",
    resource: "module",
    action: "batches",
    description: "Access batches module.",
  },
  {
    name: "module:trainers",
    resource: "module",
    action: "trainers",
    description: "Access trainers module.",
  },
  {
    name: "module:attendance",
    resource: "module",
    action: "attendance",
    description: "Access attendance module.",
  },
  {
    name: "module:assessments",
    resource: "module",
    action: "assessments",
    description: "Access assessments module.",
  },
  {
    name: "module:certifications",
    resource: "module",
    action: "certifications",
    description: "Access certifications module.",
  },
  {
    name: "module:readiness",
    resource: "module",
    action: "readiness",
    description: "Access readiness module.",
  },
  {
    name: "module:language_lab",
    resource: "module",
    action: "language_lab",
    description: "Access language lab module.",
  },
  {
    name: "module:payments",
    resource: "module",
    action: "payments",
    description: "Access payments module.",
  },
  {
    name: "module:support",
    resource: "module",
    action: "support",
    description: "Access support module.",
  },
  {
    name: "candidate:read",
    resource: "candidate",
    action: "read",
    description: "Read candidate records.",
  },
  {
    name: "candidate:update",
    resource: "candidate",
    action: "update",
    description: "Update candidate records.",
  },
  {
    name: "system:manage_users",
    resource: "system",
    action: "manage_users",
    description: "Create, update, deactivate, and assign roles to users.",
  },
  {
    name: "system:manage_roles",
    resource: "system",
    action: "manage_roles",
    description: "Create, update, and assign roles and permissions.",
  },
];

const RBAC_ROLE_PERMISSIONS = {
  "Super Admin": ["all:*"],
  Admin: ["candidate:read", "candidate:update", "system:manage_users", "system:manage_roles"],
  Candidate: ["candidate:read_own", "candidate:update_own"],
};

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

async function upsertUser({ email, name, phone, password, role }) {
  const hashedPassword = hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    update: { name, phone, password: hashedPassword, role, isActive: true },
    create: { email, name, phone, password: hashedPassword, role, isActive: true, metadata: {} },
  });
}

async function seedRbac({ adminUserId, candidateUserId }) {
  const rolesByName = new Map();

  for (const role of RBAC_ROLES) {
    const roleRecord = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        isSystem: role.isSystem,
      },
      create: role,
    });

    rolesByName.set(roleRecord.name, roleRecord);
  }

  const permissionsByName = new Map();

  for (const permission of RBAC_PERMISSIONS) {
    const permissionRecord = await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
      create: permission,
    });

    permissionsByName.set(permissionRecord.name, permissionRecord);
  }

  for (const [roleName, permissionNames] of Object.entries(RBAC_ROLE_PERMISSIONS)) {
    const role = rolesByName.get(roleName);
    if (!role) {
      continue;
    }

    for (const permissionName of permissionNames) {
      const permission = permissionsByName.get(permissionName);
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const adminRole = rolesByName.get("Admin");
  const superAdminRole = rolesByName.get("Super Admin");
  const candidateRole = rolesByName.get("Candidate");

  if (adminRole) {
    const adminUsers = await prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
      },
      select: {
        id: true,
      },
    });

    for (const user of adminUsers) {
      await prisma.userRoleAssignment.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: adminRole.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });
    }
  }

  if (superAdminRole && adminUserId) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId: adminUserId,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUserId,
        roleId: superAdminRole.id,
      },
    });
  }

  if (candidateRole) {
    const candidateUsers = await prisma.user.findMany({
      where: {
        role: UserRole.CANDIDATE,
      },
      select: {
        id: true,
      },
    });

    for (const user of candidateUsers) {
      await prisma.userRoleAssignment.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: candidateRole.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: candidateRole.id,
        },
      });
    }
  }

  return {
    roleCount: rolesByName.size,
    permissionCount: permissionsByName.size,
    assignmentCount: await prisma.userRoleAssignment.count({
      where: {
        userId: {
          in: [adminUserId, candidateUserId].filter(Boolean),
        },
      },
    }),
  };
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
  const adminUser = await upsertUser({
    email: "admin@gts-academy.test",
    name: "Academy Admin",
    phone: "+91-9000000001",
    password: "dev-password",
    role: UserRole.ADMIN,
  });

  const candidateUser = await upsertUser({
    email: "candidate@gts-academy.test",
    name: "Candidate Demo",
    phone: "+91-9000000010",
    password: "dev-password",
    role: UserRole.CANDIDATE,
  });

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
      role: UserRole.TRAINER,
    });

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

  if (learnerRecords[0]) {
    await prisma.learner.update({
      where: { id: learnerRecords[0].id },
      data: {
        userId: candidateUser.id,
        email: candidateUser.email,
        fullName: candidateUser.name,
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

  const rbacSummary = await seedRbac({
    adminUserId: adminUser.id,
    candidateUserId: candidateUser.id,
  });

  const readyCount = await prisma.learner.count({ where: { placementStatus: PlacementStatus.PLACEMENT_READY } });

  console.log("Seed complete", {
    programs: programRecords.length,
    trainers: trainerRecords.length,
    learners: learnerRecords.length,
    placementReadyLearners: readyCount,
    batches: batchRecords.length,
    rbacRoles: rbacSummary.roleCount,
    rbacPermissions: rbacSummary.permissionCount,
    rbacAssignments: rbacSummary.assignmentCount,
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
