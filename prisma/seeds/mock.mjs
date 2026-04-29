// Seeds all mock/dev data: users, centres, courses, curricula, programs,
// trainers, batches, learners, and all per-learner records.
// Blocked in production by the CLI orchestrator in seed.mjs.

import {
  AssessmentMode,
  AssessmentType,
  AttendanceSessionSource,
  AttendanceStatus,
  BatchMode,
  BatchStatus,
  CertificateStatus,
  CurriculumStatus,
  EnrollmentStatus,
  EvaluationStatus,
  InterviewType,
  PlacementStatus,
  SyncStatus,
  TrainerAvailabilityStatus,
} from "@prisma/client";

import {
  assignUserRole,
  deriveCodePrefix,
  formatEntityCode,
  makeUuid,
  placementForIndex,
  resolveTrainerEmployeeCode,
  upsertUser,
} from "./utils.mjs";
import {
  COURSES,
  CURRICULUM_SEEDS,
  FIRST_NAMES,
  LAST_NAMES,
  PROGRAMS,
  TRAINERS,
  TRAINING_CENTRES,
} from "./mock-data.mjs";

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ roleRecords: Record<string, { id: string }>, adminUser: { id: string }, kochi: { id: number } }} essentialData
 */
export async function seedMockData(prisma, { roleRecords, adminUser, kochi }) {
  // --- Seed additional test users for each role ---
  const academyAdminUser = await upsertUser(prisma, {
    email: "academyadmin@gts-academy.test",
    name: "Academy Admin User",
    phone: "+91-9000000050",
    password: "dev-password",
  });
  await assignUserRole(prisma, academyAdminUser.id, roleRecords.ACADEMY_ADMIN.id);

  const contentMgrUser = await upsertUser(prisma, {
    email: "contentmgr@gts-academy.test",
    name: "Content Manager",
    phone: "+91-9000000051",
    password: "dev-password",
  });
  await assignUserRole(prisma, contentMgrUser.id, roleRecords.CONTENT_MANAGER.id);

  const supportUser = await upsertUser(prisma, {
    email: "supportuser@gts-academy.test",
    name: "Support User",
    phone: "+91-9000000052",
    password: "dev-password",
  });
  await assignUserRole(prisma, supportUser.id, roleRecords.SUPPORT_USER.id);

  // --- Training centres ---
  const centreRecords = [];
  for (const centreDef of TRAINING_CENTRES) {
    const centre = await prisma.trainingCentre.upsert({
      where: { id: centreDef.id },
      update: {
        name: centreDef.name,
        addressLine1: centreDef.addressLine1,
        addressLine2: centreDef.addressLine2,
        landmark: centreDef.landmark,
        postalCode: centreDef.postalCode,
        locationId: kochi.id,
        totalCapacity: centreDef.totalCapacity,
        currentUtilization: centreDef.currentUtilization,
        complianceStatus: centreDef.complianceStatus,
        infrastructure: { labs: 4, classrooms: 8 },
        isActive: true,
      },
      create: {
        id: centreDef.id,
        name: centreDef.name,
        addressLine1: centreDef.addressLine1,
        addressLine2: centreDef.addressLine2,
        landmark: centreDef.landmark,
        postalCode: centreDef.postalCode,
        locationId: kochi.id,
        totalCapacity: centreDef.totalCapacity,
        currentUtilization: centreDef.currentUtilization,
        complianceStatus: centreDef.complianceStatus,
        infrastructure: { labs: 4, classrooms: 8 },
        isActive: true,
      },
    });
    centreRecords.push(centre);
  }

  // --- Courses ---
  const courseRecords = [];
  for (const course of COURSES) {
    const courseSequence =
      courseRecords.filter((record) => deriveCodePrefix(record.name) === deriveCodePrefix(course.name)).length + 1;
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

  // --- Curricula ---
  const seededCurricula = [];
  for (const curriculumSeed of CURRICULUM_SEEDS) {
    const seededCourse = courseRecords.find((course) => course.name === curriculumSeed.courseName);
    if (!seededCourse) {
      throw new Error(`Missing seeded course for curriculum ${curriculumSeed.title}.`);
    }

    const curriculum = await prisma.curriculum.upsert({
      where: { courseId_title: { courseId: seededCourse.id, title: curriculumSeed.title } },
      update: {
        description: curriculumSeed.description,
        status: CurriculumStatus.DRAFT,
        createdById: adminUser.id,
      },
      create: {
        courseId: seededCourse.id,
        title: curriculumSeed.title,
        description: curriculumSeed.description,
        status: CurriculumStatus.DRAFT,
        createdById: adminUser.id,
      },
    });

    const moduleRecord = await prisma.curriculumModule.upsert({
      where: { curriculumId_title: { curriculumId: curriculum.id, title: curriculumSeed.moduleTitle } },
      update: { description: curriculumSeed.moduleDescription, sortOrder: 0 },
      create: {
        curriculumId: curriculum.id,
        title: curriculumSeed.moduleTitle,
        description: curriculumSeed.moduleDescription,
        sortOrder: 0,
      },
    });

    for (let stageIndex = 0; stageIndex < curriculumSeed.stages.length; stageIndex += 1) {
      const stageSeed = curriculumSeed.stages[stageIndex];
      await prisma.curriculumStage.upsert({
        where: { moduleId_title: { moduleId: moduleRecord.id, title: stageSeed.title } },
        update: { description: stageSeed.description, sortOrder: stageIndex },
        create: {
          moduleId: moduleRecord.id,
          title: stageSeed.title,
          description: stageSeed.description,
          sortOrder: stageIndex,
        },
      });
    }

    seededCurricula.push({
      courseName: curriculumSeed.courseName,
      curriculumId: curriculum.id,
      stageCount: curriculumSeed.stages.length,
    });
  }

  // --- Programs ---
  const programRecords = [];
  for (const program of PROGRAMS) {
    const mappedCourse = courseByType.get(program.type);
    if (!mappedCourse) {
      throw new Error(`Missing seeded course for program type ${program.type}.`);
    }

    const programSequence =
      programRecords.filter((record) => deriveCodePrefix(record.name) === deriveCodePrefix(program.name)).length + 1;

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

  // --- Trainers ---
  const trainerRecords = [];
  for (let i = 0; i < TRAINERS.length; i += 1) {
    const profile = TRAINERS[i];
    const user = await upsertUser(prisma, {
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      password: "dev-password",
    });
    await assignUserRole(prisma, user.id, roleRecords.TRAINER.id);

    const assignedCourses = [
      courseByType.get(programRecords[i % programRecords.length].type),
      courseByType.get(programRecords[(i + 3) % programRecords.length].type),
    ].filter(Boolean);

    const employeeCode = await resolveTrainerEmployeeCode(prisma, {
      userId: user.id,
      sequence: i + 1,
    });

    const trainer = await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      update: {
        employeeCode,
        specialization: profile.specialization,
        bio: `${profile.specialization} trainer focused on measurable outcomes.`,
        rating: profile.rating,
        capacity: 4,
        isActive: true,
        availabilityStatus: TrainerAvailabilityStatus.AVAILABLE,
      },
      create: {
        userId: user.id,
        employeeCode,
        specialization: profile.specialization,
        bio: `${profile.specialization} trainer focused on measurable outcomes.`,
        rating: profile.rating,
        capacity: 4,
        isActive: true,
        availabilityStatus: TrainerAvailabilityStatus.AVAILABLE,
      },
    });

    await prisma.trainerCourseAssignment.deleteMany({ where: { trainerId: trainer.id } });
    if (assignedCourses.length > 0) {
      await prisma.trainerCourseAssignment.createMany({
        data: assignedCourses.map((course) => ({ trainerId: trainer.id, courseId: course.id })),
        skipDuplicates: true,
      });
    }

    trainerRecords.push({ ...trainer, courseIds: assignedCourses.map((course) => course.id) });
  }

  // --- Batches ---
  const batchRecords = [];
  for (let i = 0; i < programRecords.length; i += 1) {
    const program = programRecords[i];
    const centre = centreRecords[i % centreRecords.length];
    const courseId = courseByType.get(program.type)?.id;
    const eligibleTrainers = trainerRecords.filter((trainer) =>
      Array.isArray(trainer.courseIds) && courseId ? trainer.courseIds.includes(courseId) : false,
    );
    const primaryTrainer = eligibleTrainers[0] ?? trainerRecords[i % trainerRecords.length];
    const connectedTrainers = eligibleTrainers.length > 0 ? eligibleTrainers.slice(0, 2) : [primaryTrainer];
    const prefix = program.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
    const code = `B-${prefix}-${String(i + 1).padStart(3, "0")}`;
    const mode = i % 3 === 0 ? BatchMode.ONLINE : BatchMode.OFFLINE;
    const batchCentreId = mode === BatchMode.OFFLINE ? centre.id : null;
    const batchCampus = mode === BatchMode.OFFLINE ? centre.name : null;

    const batch = await prisma.batch.upsert({
      where: { code },
      update: {
        name: `${program.name} Cohort ${i + 1}`,
        programId: program.id,
        centreId: batchCentreId,
        trainerId: primaryTrainer.id,
        trainers: { set: connectedTrainers.map((trainer) => ({ id: trainer.id })) },
        campus: batchCampus,
        startDate: new Date(Date.UTC(2026, i % 6, 1 + (i % 4))),
        endDate: new Date(Date.UTC(2026, (i % 6) + 4, 15)),
        mode,
        status: i % 4 === 0 ? BatchStatus.PLANNED : BatchStatus.IN_SESSION,
        capacity: 25 + (i % 5) * 5,
        schedule: ["MON", "WED", "FRI"],
      },
      create: {
        code,
        name: `${program.name} Cohort ${i + 1}`,
        programId: program.id,
        centreId: batchCentreId,
        trainerId: primaryTrainer.id,
        trainers: { connect: connectedTrainers.map((trainer) => ({ id: trainer.id })) },
        campus: batchCampus,
        startDate: new Date(Date.UTC(2026, i % 6, 1 + (i % 4))),
        endDate: new Date(Date.UTC(2026, (i % 6) + 4, 15)),
        mode,
        status: i % 4 === 0 ? BatchStatus.PLANNED : BatchStatus.IN_SESSION,
        capacity: 25 + (i % 5) * 5,
        schedule: ["MON", "WED", "FRI"],
      },
    });
    batchRecords.push(batch);
  }

  // --- Readiness rule (find-or-create, not upsert, to avoid touching existing config) ---
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

  // --- Learners + all per-learner records ---
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
    const attendanceSessionDate = new Date("2026-03-28");
    const attendanceSessionKey = `manual:${attendanceSessionDate.toISOString().slice(0, 10)}`;

    const enrollment = await prisma.batchEnrollment.upsert({
      where: { learnerId_batchId: { learnerId: learner.id, batchId: batch.id } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { learnerId: learner.id, batchId: batch.id, status: EnrollmentStatus.ACTIVE },
    });

    const attendanceSession = await prisma.attendanceSession.upsert({
      where: { batchId_sessionKey: { batchId: batch.id, sessionKey: attendanceSessionKey } },
      update: { title: "Seeded manual attendance", createdById: adminUser.id },
      create: {
        batchId: batch.id,
        sourceType: AttendanceSessionSource.MANUAL,
        sessionKey: attendanceSessionKey,
        sessionDate: attendanceSessionDate,
        title: "Seeded manual attendance",
        createdById: adminUser.id,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_attendanceSessionId: {
          enrollmentId: enrollment.id,
          attendanceSessionId: attendanceSession.id,
        },
      },
      update: {
        status: i % 7 === 0 ? AttendanceStatus.LATE : i % 11 === 0 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
        markedById: adminUser.id,
        notes: "Seeded attendance record",
      },
      create: {
        enrollmentId: enrollment.id,
        attendanceSessionId: attendanceSession.id,
        sessionDate: attendanceSessionDate,
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

  // --- Assessments (one per batch) ---
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

  // --- Assessment scores (one per learner) ---
  for (let i = 0; i < learnerRecords.length; i += 1) {
    const learner = learnerRecords[i];
    const assessment = assessmentRecords[i % assessmentRecords.length];
    const scoreValue = 62 + (i % 35);

    await prisma.assessmentScore.upsert({
      where: { assessmentId_learnerId: { assessmentId: assessment.id, learnerId: learner.id } },
      update: { score: scoreValue, feedback: "Seeded assessment score" },
      create: { assessmentId: assessment.id, learnerId: learner.id, score: scoreValue, feedback: "Seeded assessment score" },
    });
  }

  // --- Trainer PMS logs (one per trainer) ---
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

  console.log("Mock data seeded", {
    curricula: seededCurricula.length,
    curriculumStagesSeeded: seededCurricula.reduce((total, item) => total + item.stageCount, 0),
    programs: programRecords.length,
    trainers: trainerRecords.length,
    learners: learnerRecords.length,
    placementReadyLearners: readyCount,
    batches: batchRecords.length,
  });
}
