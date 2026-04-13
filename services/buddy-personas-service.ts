import "server-only";

import { Prisma } from "@prisma/client";

import type {
  CandidateBuddyPersona,
  LanguageLabBuddyPersonaItem,
} from "@/lib/language-lab/types";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  CreateBuddyPersonaInput,
  ListBuddyPersonasInput,
  UpdateBuddyPersonaInput,
} from "@/lib/validation-schemas/language-lab";
import { sendCandidateBuddyPersonaAvailableNotification } from "@/services/candidate-notifications";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";

const buddyPersonaSelect = {
  id: true,
  name: true,
  normalizedName: true,
  description: true,
  language: true,
  languageCode: true,
  systemPrompt: true,
  welcomeMessage: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  courseAssignments: {
    orderBy: {
      course: {
        name: "asc",
      },
    },
    select: {
      assignedAt: true,
      course: {
        select: {
          id: true,
          name: true,
          status: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.BuddyPersonaSelect;

const candidateBuddyPersonaSelect = {
  id: true,
  name: true,
  description: true,
  language: true,
  languageCode: true,
  systemPrompt: true,
  welcomeMessage: true,
  isActive: true,
} satisfies Prisma.BuddyPersonaSelect;

type BuddyPersonaRecord = Prisma.BuddyPersonaGetPayload<{ select: typeof buddyPersonaSelect }>;
type CandidateBuddyPersonaRecord = Prisma.BuddyPersonaGetPayload<{ select: typeof candidateBuddyPersonaSelect }>;

function normalizePersonaName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function uniqueCourseIds(courseIds: string[] | undefined) {
  return Array.from(
    new Set((courseIds ?? []).map((courseId) => courseId.trim()).filter((courseId) => courseId.length > 0)),
  );
}

function mapBuddyPersona(record: BuddyPersonaRecord): LanguageLabBuddyPersonaItem {
  return {
    id: record.id,
    name: record.name,
    normalizedName: record.normalizedName,
    description: record.description,
    language: record.language,
    languageCode: record.languageCode,
    systemPrompt: record.systemPrompt,
    welcomeMessage: record.welcomeMessage,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    assignedCourses: record.courseAssignments.map((assignment) => ({
      courseId: assignment.course.id,
      courseName: assignment.course.name,
      courseStatus: assignment.course.status,
      isCourseActive: assignment.course.isActive,
      assignedAt: assignment.assignedAt.toISOString(),
    })),
  };
}

function mapCandidateBuddyPersona(record: CandidateBuddyPersonaRecord): CandidateBuddyPersona {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    language: record.language,
    languageCode: record.languageCode,
    systemPrompt: record.systemPrompt,
    welcomeMessage: record.welcomeMessage,
  };
}

async function ensureCoursesExist(tx: Prisma.TransactionClient, courseIds: string[]) {
  if (courseIds.length === 0) {
    return;
  }

  const courses = await tx.course.findMany({
    where: {
      id: {
        in: courseIds,
      },
    },
    select: {
      id: true,
    },
  });

  const existingCourseIds = new Set(courses.map((course) => course.id));
  const missingCourseIds = courseIds.filter((courseId) => !existingCourseIds.has(courseId));

  if (missingCourseIds.length > 0) {
    throw new Error("One or more selected courses no longer exist.");
  }
}

async function notifyLearnersAboutBuddyPersona(
  courseIds: string[],
  persona: CandidateBuddyPersona,
  actorUserId?: string | null,
) {
  if (!isDatabaseConfigured || !persona.name || courseIds.length === 0) {
    return;
  }

  const enrollments = await prisma.batchEnrollment.findMany({
    where: {
      status: "ACTIVE",
      learner: {
        is: {
          isActive: true,
        },
      },
      batch: {
        program: {
          courseId: {
            in: courseIds,
          },
        },
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
    select: {
      learnerId: true,
      batchId: true,
      batch: {
        select: {
          program: {
            select: {
              courseId: true,
            },
          },
        },
      },
    },
  });

  const recipients = Array.from(
    new Map(
      enrollments.map((enrollment) => [
        `${enrollment.batch.program.courseId}:${enrollment.learnerId}`,
        {
          learnerId: enrollment.learnerId,
          batchId: enrollment.batchId,
        },
      ]),
    ).values(),
  );

  const settled = await Promise.allSettled(
    recipients.map((recipient) =>
      sendCandidateBuddyPersonaAvailableNotification({
        learnerId: recipient.learnerId,
        batchId: recipient.batchId,
        buddyPersonaName: persona.name,
        buddyLanguage: persona.language,
        actorUserId,
      }),
    ),
  );

  for (const result of settled) {
    if (result.status === "rejected") {
      console.warn("Buddy persona notification dispatch failed.", result.reason);
    }
  }
}

function createPersonaAuditMetadata(persona: LanguageLabBuddyPersonaItem) {
  return {
    domain: "LANGUAGE_LAB_BUDDY",
    buddyPersonaId: persona.id,
    buddyPersonaName: persona.name,
    language: persona.language,
    languageCode: persona.languageCode,
    isActive: persona.isActive,
    courseIds: persona.assignedCourses.map((course) => course.courseId),
  };
}

export async function listBuddyPersonasService(input: ListBuddyPersonasInput): Promise<LanguageLabBuddyPersonaItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const search = input.search.trim();
  const records = await prisma.buddyPersona.findMany({
    where: {
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { language: { contains: search, mode: "insensitive" } },
              { languageCode: { contains: search, mode: "insensitive" } },
              {
                courseAssignments: {
                  some: {
                    course: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: buddyPersonaSelect,
  });

  return records.map(mapBuddyPersona);
}

export async function getBuddyPersonaByIdService(personaId: string): Promise<LanguageLabBuddyPersonaItem | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const record = await prisma.buddyPersona.findUnique({
    where: { id: personaId },
    select: buddyPersonaSelect,
  });

  return record ? mapBuddyPersona(record) : null;
}

export async function createBuddyPersonaService(
  input: CreateBuddyPersonaInput,
  options?: { actorUserId?: string | null },
): Promise<LanguageLabBuddyPersonaItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Buddy personas require a configured database.");
  }

  const courseIds = uniqueCourseIds(input.courseIds);
  const normalizedName = normalizePersonaName(input.name);

  try {
    const persona = await prisma.$transaction(async (tx) => {
      await ensureCoursesExist(tx, courseIds);

      const created = await tx.buddyPersona.create({
        data: {
          name: input.name.trim(),
          normalizedName,
          description: trimToNull(input.description),
          language: input.language.trim(),
          languageCode: input.languageCode.trim(),
          systemPrompt: trimToNull(input.systemPrompt),
          welcomeMessage: trimToNull(input.welcomeMessage),
          isActive: input.isActive,
        },
        select: {
          id: true,
          name: true,
          description: true,
          language: true,
          languageCode: true,
          systemPrompt: true,
          welcomeMessage: true,
          isActive: true,
        },
      });

      if (courseIds.length > 0) {
        await tx.buddyPersonaCourseAssignment.deleteMany({
          where: {
            courseId: {
              in: courseIds,
            },
          },
        });

        await tx.buddyPersonaCourseAssignment.createMany({
          data: courseIds.map((courseId) => ({
            buddyPersonaId: created.id,
            courseId,
          })),
        });
      }

      const record = await tx.buddyPersona.findUnique({
        where: { id: created.id },
        select: buddyPersonaSelect,
      });

      if (!record) {
        throw new Error("Buddy persona could not be loaded after creation.");
      }

      return mapBuddyPersona(record);
    });

    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.SYSTEM,
      entityId: persona.id,
      action: AUDIT_ACTION_TYPE.CREATED,
      actorUserId: options?.actorUserId ?? null,
      message: `Buddy persona ${persona.name} created.`,
      metadata: createPersonaAuditMetadata(persona),
    });

    if (persona.isActive && courseIds.length > 0) {
      await notifyLearnersAboutBuddyPersona(courseIds, {
        id: persona.id,
        name: persona.name,
        description: persona.description,
        language: persona.language,
        languageCode: persona.languageCode,
        systemPrompt: persona.systemPrompt,
        welcomeMessage: persona.welcomeMessage,
      }, options?.actorUserId ?? null);
    }

    return persona;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A Buddy persona with this name already exists.");
    }

    throw error;
  }
}

export async function updateBuddyPersonaService(
  personaId: string,
  input: UpdateBuddyPersonaInput,
  options?: { actorUserId?: string | null },
): Promise<LanguageLabBuddyPersonaItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Buddy personas require a configured database.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.buddyPersona.findUnique({
        where: { id: personaId },
        select: {
          id: true,
          name: true,
          normalizedName: true,
          isActive: true,
          courseAssignments: {
            select: {
              courseId: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Buddy persona not found.");
      }

      const currentCourseIds = existing.courseAssignments.map((assignment) => assignment.courseId);
      const nextCourseIds = input.courseIds === undefined ? currentCourseIds : uniqueCourseIds(input.courseIds);

      await ensureCoursesExist(tx, nextCourseIds);

      const nextIsActive = input.isActive ?? existing.isActive;
      const addedCourseIds = nextCourseIds.filter((courseId) => !currentCourseIds.includes(courseId));

      if (input.courseIds !== undefined) {
        await tx.buddyPersonaCourseAssignment.deleteMany({
          where: {
            buddyPersonaId: personaId,
            ...(nextCourseIds.length > 0
              ? {
                  courseId: {
                    notIn: nextCourseIds,
                  },
                }
              : {}),
          },
        });

        if (nextCourseIds.length > 0) {
          await tx.buddyPersonaCourseAssignment.deleteMany({
            where: {
              courseId: {
                in: nextCourseIds,
              },
              NOT: {
                buddyPersonaId: personaId,
              },
            },
          });

          const existingAssignmentIds = new Set(currentCourseIds);
          const newAssignments = nextCourseIds
            .filter((courseId) => !existingAssignmentIds.has(courseId))
            .map((courseId) => ({
              buddyPersonaId: personaId,
              courseId,
            }));

          if (newAssignments.length > 0) {
            await tx.buddyPersonaCourseAssignment.createMany({
              data: newAssignments,
            });
          }
        }
      }

      await tx.buddyPersona.update({
        where: { id: personaId },
        data: {
          ...(input.name !== undefined
            ? {
                name: input.name.trim(),
                normalizedName: normalizePersonaName(input.name),
              }
            : {}),
          ...(input.description !== undefined ? { description: trimToNull(input.description) } : {}),
          ...(input.language !== undefined ? { language: input.language.trim() } : {}),
          ...(input.languageCode !== undefined ? { languageCode: input.languageCode.trim() } : {}),
          ...(input.systemPrompt !== undefined ? { systemPrompt: trimToNull(input.systemPrompt) } : {}),
          ...(input.welcomeMessage !== undefined ? { welcomeMessage: trimToNull(input.welcomeMessage) } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      const record = await tx.buddyPersona.findUnique({
        where: { id: personaId },
        select: buddyPersonaSelect,
      });

      if (!record) {
        throw new Error("Buddy persona not found after update.");
      }

      const persona = mapBuddyPersona(record);
      const notifyCourseIds = !existing.isActive && nextIsActive ? nextCourseIds : nextIsActive ? addedCourseIds : [];

      return {
        persona,
        notifyCourseIds,
      };
    });

    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.SYSTEM,
      entityId: result.persona.id,
      action: AUDIT_ACTION_TYPE.UPDATED,
      actorUserId: options?.actorUserId ?? null,
      message: `Buddy persona ${result.persona.name} updated.`,
      metadata: createPersonaAuditMetadata(result.persona),
    });

    if (result.notifyCourseIds.length > 0 && result.persona.isActive) {
      await notifyLearnersAboutBuddyPersona(result.notifyCourseIds, {
        id: result.persona.id,
        name: result.persona.name,
        description: result.persona.description,
        language: result.persona.language,
        languageCode: result.persona.languageCode,
        systemPrompt: result.persona.systemPrompt,
        welcomeMessage: result.persona.welcomeMessage,
      }, options?.actorUserId ?? null);
    }

    return result.persona;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A Buddy persona with this name already exists.");
    }

    throw error;
  }
}

export async function resolveBuddyPersonaForCourseService(courseId: string): Promise<CandidateBuddyPersona | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const assignment = await prisma.buddyPersonaCourseAssignment.findUnique({
    where: { courseId },
    select: {
      buddyPersona: {
        select: candidateBuddyPersonaSelect,
      },
    },
  });

  if (!assignment?.buddyPersona || !assignment.buddyPersona.isActive) {
    return null;
  }

  return mapCandidateBuddyPersona(assignment.buddyPersona);
}

export async function resolveBuddyPersonaForBatchService(batchId: string): Promise<CandidateBuddyPersona | null> {
  const batchContext = await getBatchCourseContext(batchId);

  if (!batchContext) {
    return null;
  }

  return resolveBuddyPersonaForCourseService(batchContext.courseId);
}