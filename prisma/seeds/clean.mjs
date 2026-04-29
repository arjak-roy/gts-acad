// Deletes all mock/dev data in reverse FK order so the database can be
// re-seeded cleanly. Only called in --force mode from the CLI orchestrator.
// Never touches essential data (roles, permissions, settings, users, geo).

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
export async function cleanMockData(prisma) {
  const tables = [
    "trainerPmsLog",
    "assessmentScore",
    "assessment",
    "interview",
    "roleplay",
    "performanceMetric",
    "certificate",
    "recruiterSyncLog",
    "readinessSnapshot",
    "candidateDocument",
    "candidateBasicDetails",
    "attendanceRecord",
    "attendanceSession",
    "batchEnrollment",
    "learner",
    "batch",
    
    "trainerCourseAssignment",
    "trainerProfile",
    "program",
    "curriculumStage",
    "curriculumModule",
    "curriculum",
    "course",
    "trainingCentre",
    "readinessEngineRule",
  ];

  for (const table of tables) {
    const count = await prisma[table].deleteMany();
    if (count.count > 0) {
      console.log(`  cleaned ${table}: ${count.count} rows`);
    }
  }

  console.log("Mock data cleaned");
}
