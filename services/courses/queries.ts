import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { listAssignedSharedCourseContentService } from "@/services/course-content-service";
import { mapCourseOption, sortCoursesByLifecycle } from "@/services/courses/internal-helpers";
import { MOCK_COURSES } from "@/services/courses/mock-data";
import { CourseDetail, CourseOption } from "@/services/courses/types";

function buildTrainerNames(input: Array<{ id: string; user: { name: string } }>, leadTrainer?: { id: string; user: { name: string } } | null) {
  const trainerIds = new Set<string>();
  const trainerNames: string[] = [];

  for (const trainer of [leadTrainer, ...input].filter((value): value is { id: string; user: { name: string } } => Boolean(value))) {
    if (trainerIds.has(trainer.id)) {
      continue;
    }

    trainerIds.add(trainer.id);
    trainerNames.push(trainer.user.name);
  }

  return {
    trainerIds: Array.from(trainerIds),
    trainerNames,
  };
}

export async function listCoursesService(): Promise<CourseOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_COURSES.map(mapCourseOption);
  }

  try {
    const courses = await prisma.course.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
        _count: { select: { programs: true } },
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      status: course.status,
      isActive: course.isActive,
      programCount: course._count.programs,
    })).sort(sortCoursesByLifecycle);
  } catch (error) {
    console.warn("Course list fallback activated", error);
    return MOCK_COURSES.map(mapCourseOption);
  }
}

export async function searchCoursesService(query: string, limit: number): Promise<CourseOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_COURSES.filter(
      (course) =>
        course.name.toLowerCase().includes(normalizedQuery) ||
        (course.description ?? "").toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map(mapCourseOption);
  }

  try {
    const courses = await prisma.course.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
        _count: { select: { programs: true } },
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      status: course.status,
      isActive: course.isActive,
      programCount: course._count.programs,
    })).sort(sortCoursesByLifecycle);
  } catch (error) {
    console.warn("Course search fallback activated", error);
    return MOCK_COURSES.filter(
      (course) =>
        course.name.toLowerCase().includes(normalizedQuery) ||
        (course.description ?? "").toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map(mapCourseOption);
  }
}

export async function getCourseByIdService(courseId: string): Promise<CourseDetail | null> {
  if (!isDatabaseConfigured) {
    return MOCK_COURSES.find((course) => course.id === courseId) ?? null;
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
        programs: {
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
            batches: {
              orderBy: [{ startDate: "desc" }, { code: "asc" }],
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
                mode: true,
                campus: true,
                startDate: true,
                endDate: true,
                capacity: true,
                trainer: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
                trainers: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
                enrollments: {
                  where: { status: "ACTIVE" },
                  orderBy: [{ joinedAt: "desc" }],
                  select: {
                    joinedAt: true,
                    learner: {
                      select: {
                        id: true,
                        learnerCode: true,
                        fullName: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    const trainers = await prisma.trainerProfile.findMany({
      where: {
        OR: [
          {
            courseAssignments: {
              some: {
                courseId: course.id,
              },
            },
          },
          {
            leadBatches: {
              some: {
                program: {
                  courseId: course.id,
                },
              },
            },
          },
          {
            batches: {
              some: {
                program: {
                  courseId: course.id,
                },
              },
            },
          },
        ],
      },
      orderBy: [{ joinedAt: "desc" }],
      select: {
        id: true,
        specialization: true,
        isActive: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        leadBatches: {
          where: {
            program: {
              courseId: course.id,
            },
          },
          orderBy: [{ startDate: "desc" }, { code: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            program: {
              select: {
                name: true,
              },
            },
          },
        },
        batches: {
          where: {
            program: {
              courseId: course.id,
            },
          },
          orderBy: [{ startDate: "desc" }, { code: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            program: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const candidateMap = new Map<string, CourseDetail["candidates"][number]>();
    const batches: CourseDetail["batches"] = [];

    const programs = course.programs.map((program) => {
      const programTrainerIds = new Set<string>();
      const programCandidateIds = new Set<string>();

      const mappedBatches = program.batches.map((batch) => {
        const { trainerIds, trainerNames } = buildTrainerNames(batch.trainers, batch.trainer);

        for (const trainerId of trainerIds) {
          programTrainerIds.add(trainerId);
        }

        for (const enrollment of batch.enrollments) {
          programCandidateIds.add(enrollment.learner.id);

          const existingCandidate = candidateMap.get(enrollment.learner.id);
          const nextEnrollment = {
            batchId: batch.id,
            batchCode: batch.code,
            batchName: batch.name,
            programId: program.id,
            programName: program.name,
            joinedAt: enrollment.joinedAt.toISOString(),
          };

          if (existingCandidate) {
            existingCandidate.enrollments.push(nextEnrollment);
          } else {
            candidateMap.set(enrollment.learner.id, {
              id: enrollment.learner.id,
              learnerCode: enrollment.learner.learnerCode,
              fullName: enrollment.learner.fullName,
              email: enrollment.learner.email,
              phone: enrollment.learner.phone,
              enrollmentCount: 0,
              enrollments: [nextEnrollment],
            });
          }
        }

        const mappedBatch = {
          id: batch.id,
          programId: program.id,
          programName: program.name,
          programType: program.type,
          code: batch.code,
          name: batch.name,
          status: batch.status,
          mode: batch.mode,
          campus: batch.campus,
          startDate: batch.startDate?.toISOString() ?? null,
          endDate: batch.endDate?.toISOString() ?? null,
          capacity: batch.capacity,
          trainerIds,
          trainerNames,
          candidateCount: batch.enrollments.length,
        };

        batches.push(mappedBatch);
        return mappedBatch;
      });

      return {
        id: program.id,
        name: program.name,
        type: program.type,
        isActive: program.isActive,
        batches: mappedBatches,
        batchCount: mappedBatches.length,
        trainerCount: programTrainerIds.size,
        candidateCount: programCandidateIds.size,
      };
    });

    const mappedCandidates = Array.from(candidateMap.values())
      .map((candidate) => ({
        ...candidate,
        enrollments: [...candidate.enrollments].sort((left, right) => right.joinedAt.localeCompare(left.joinedAt)),
        enrollmentCount: candidate.enrollments.length,
      }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName));

    return {
      ...course,
      programs,
      batches,
      trainers: trainers
        .map((trainer) => {
          const assignmentMap = new Map<string, string>();
          const programNames = new Set<string>();

          for (const batch of [...trainer.leadBatches, ...trainer.batches]) {
            assignmentMap.set(batch.id, `${batch.program.name} • ${batch.name} (${batch.code})`);
            programNames.add(batch.program.name);
          }

          return {
            id: trainer.id,
            fullName: trainer.user.name,
            email: trainer.user.email,
            specialization: trainer.specialization,
            isActive: trainer.isActive,
            assignedBatchIds: Array.from(assignmentMap.keys()),
            assignedBatchLabels: Array.from(assignmentMap.values()),
            assignedProgramNames: Array.from(programNames).sort((left, right) => left.localeCompare(right)),
          };
        })
        .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.fullName.localeCompare(right.fullName)),
      candidates: mappedCandidates,
      assignedSharedContents: await listAssignedSharedCourseContentService(courseId),
    };
  } catch (error) {
    console.warn("Course detail fallback activated", error);
    return null;
  }
}
