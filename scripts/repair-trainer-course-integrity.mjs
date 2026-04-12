import { PrismaClient } from "@prisma/client";

import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const prisma = new PrismaClient();

function resolveDatabaseUrl(source = "DATABASE_URL") {
  return source.includes("://") ? source : process.env[source];
}

function buildTrainerLabel(trainer) {
  return `${trainer.user.name} (${trainer.employeeCode})`;
}

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const databaseUrlSource = Array.from(args).find((value) => !value.startsWith("--")) ?? "DATABASE_URL";
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
          },
        },
        trainers: {
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  const courseCatalog = new Map(courses.map((course) => [course.id, course]));
  const impliedCoursesByTrainerId = new Map();

  for (const batch of batches) {
    const courseRecord = courseCatalog.get(batch.program.course.id);
    const assignedTrainerIds = [batch.trainer?.id, ...batch.trainers.map((trainer) => trainer.id)].filter(Boolean);

    for (const trainerId of assignedTrainerIds) {
      const trainerCourses = impliedCoursesByTrainerId.get(trainerId) ?? [];
      if (courseRecord) {
        trainerCourses.push(courseRecord);
      }
      impliedCoursesByTrainerId.set(trainerId, trainerCourses);
    }
  }

  const changes = trainers
    .map((trainer) => {
      const existingCourseIds = trainer.courseAssignments.map((assignment) => assignment.course.id);
      const impliedCourses = impliedCoursesByTrainerId.get(trainer.id) ?? [];
      const nextCourses = Array.from(new Map([...trainer.courseAssignments.map((assignment) => [assignment.course.id, assignment.course]), ...impliedCourses.map((course) => [course.id, course])]).values()).sort((left, right) => left.name.localeCompare(right.name));
      const missingCourses = nextCourses.filter((course) => !existingCourseIds.includes(course.id));

      if (missingCourses.length === 0) {
        return null;
      }

      return {
        trainerId: trainer.id,
        trainerLabel: buildTrainerLabel(trainer),
        currentCourses: trainer.courseAssignments.map((assignment) => assignment.course.name).sort((left, right) => left.localeCompare(right)),
        missingCourses,
      };
    })
    .filter(Boolean);

  console.log(shouldWrite ? "Trainer-course repair apply mode" : "Trainer-course repair dry run");
  console.log(
    JSON.stringify(
      {
        trainerCount: trainers.length,
        changedTrainerCount: changes.length,
        mode: shouldWrite ? "write" : "dry-run",
      },
      null,
      2,
    ),
  );

  if (changes.length === 0) {
    console.log("No trainer-course repairs are needed.");
  } else {
    for (const change of changes) {
      console.log(`\n- ${change.trainerLabel}`);
      console.log(`  Current: ${change.currentCourses.length > 0 ? change.currentCourses.join(", ") : "(none)"}`);
      console.log(`  Add: ${change.missingCourses.map((course) => course.name).join(", ")}`);
    }
  }

  if (shouldWrite && changes.length > 0) {
    await prisma.$transaction(
      changes.flatMap((change) =>
        change.missingCourses.map((course) =>
          prisma.trainerCourseAssignment.upsert({
            where: {
              trainerId_courseId: {
                trainerId: change.trainerId,
                courseId: course.id,
              },
            },
            update: {},
            create: {
              trainerId: change.trainerId,
              courseId: course.id,
            },
          }),
        ),
      ),
    );

    console.log(`\nApplied repairs for ${changes.length} trainer profiles.`);
  }
} finally {
  await prisma.$disconnect();
}