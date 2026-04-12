import { PrismaClient } from "@prisma/client";

import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const prisma = new PrismaClient();

function resolveDatabaseUrl(source = "DATABASE_URL") {
  return source.includes("://") ? source : process.env[source];
}

function normalizeCourseName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function dedupeBy(items, buildKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = buildKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildTrainerLabel(trainer) {
  return `${trainer.user.name} (${trainer.employeeCode})`;
}

function printSection(title, rows) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  None");
    return;
  }

  rows.forEach((row) => {
    console.log(`  - ${row}`);
  });
}

const [databaseUrlSource = "DATABASE_URL"] = process.argv.slice(2);
const databaseUrl = resolveDatabaseUrl(databaseUrlSource);

if (!databaseUrl) {
  console.error(`Could not resolve a database URL from ${databaseUrlSource}.`);
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;

try {
  const [courses, trainers, batches] = await Promise.all([
    prisma.course.findMany({
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.trainerProfile.findMany({
      select: {
        id: true,
        employeeCode: true,
        courseAssignments: {
          select: {
            course: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    }),
    prisma.batch.findMany({
      select: {
        id: true,
        code: true,
        program: {
          select: {
            course: {
              select: {
                name: true,
              },
            },
          },
        },
        trainer: {
          select: {
            id: true,
            employeeCode: true,
            courseAssignments: {
              select: {
                course: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        trainers: {
          select: {
            id: true,
            employeeCode: true,
            courseAssignments: {
              select: {
                course: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    }),
  ]);

  const knownCourses = new Map(courses.map((course) => [course.id, course.name]));

  const invalidTrainerCourseEntries = trainers.flatMap((trainer) =>
    trainer.courseAssignments
      .filter((assignment) => !knownCourses.has(assignment.course.id))
      .map((assignment) => `${buildTrainerLabel(trainer)} references missing course \"${assignment.course.name}\"`),
  );

  const batchAssignmentMismatches = dedupeBy(
    batches.flatMap((batch) => {
      const courseName = batch.program.course.name;
      const assignedTrainers = [batch.trainer, ...batch.trainers].filter(Boolean);

      return assignedTrainers
        .filter((trainer) => !trainer.courseAssignments.some((assignment) => normalizeCourseName(assignment.course.name) === normalizeCourseName(courseName)))
        .map((trainer) => `${buildTrainerLabel(trainer)} is assigned to batch ${batch.code} but is missing course \"${courseName}\"`);
    }),
    (row) => row,
  );

  console.log("Trainer-course integrity report");
  console.log(JSON.stringify({
    courses: courses.length,
    trainers: trainers.length,
    batches: batches.length,
    invalidTrainerCourseEntries: invalidTrainerCourseEntries.length,
    batchAssignmentMismatches: batchAssignmentMismatches.length,
  }, null, 2));

  printSection("Invalid trainer course names", invalidTrainerCourseEntries);
  printSection("Batch assignment mismatches", batchAssignmentMismatches);

  if (invalidTrainerCourseEntries.length > 0 || batchAssignmentMismatches.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}