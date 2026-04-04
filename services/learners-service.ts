import "server-only";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { AuditActionType, AuditEntityType } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { renderEmailTemplateByKeyService } from "@/services/email-templates-service";
import { createAuditLogEntry, deliverLoggedEmail } from "@/services/logs-actions-service";
import { addRoleToUser } from "@/services/rbac-service";
import { CreateLearnerEnrollmentInput, CreateLearnerInput, GetLearnersInput } from "@/lib/validation-schemas/learners";
import { LearnerActiveEnrollment, LearnerDetail, LearnerListItem, LearnersResponse } from "@/types";

const MOCK_LEARNERS: LearnerListItem[] = [
  {
    id: "clx1",
    learnerCode: "GTS-240901",
    fullName: "Aditya Sharma",
    email: "aditya.sharma@gts-academy.test",
    attendancePercentage: 98.4,
    averageScore: 84,
    readinessPercentage: 82,
    placementStatus: "PLACEMENT_READY" as const,
    recruiterSyncStatus: "NOT_SYNCED" as const,
    programName: "German Language (B1)",
    batchCode: "B-GER-NOV",
    campus: "Main Campus",
    trainerName: "Dr. Markus S.",
    programType: "LANGUAGE" as const,
  },
  {
    id: "clx2",
    learnerCode: "GTS-240902",
    fullName: "Meera Nair",
    email: "meera.nair@gts-academy.test",
    attendancePercentage: 92.1,
    averageScore: 79,
    readinessPercentage: 76,
    placementStatus: "IN_REVIEW" as const,
    recruiterSyncStatus: "NOT_SYNCED" as const,
    programName: "Clinical Bridging",
    batchCode: "B-CLI-OCT",
    campus: "South Wing",
    trainerName: "Dr. Leena P.",
    programType: "CLINICAL" as const,
  },
  {
    id: "clx3",
    learnerCode: "GTS-240903",
    fullName: "Arjun Mehta",
    email: "arjun.mehta@gts-academy.test",
    attendancePercentage: 88.7,
    averageScore: 81,
    readinessPercentage: 85,
    placementStatus: "PLACEMENT_READY" as const,
    recruiterSyncStatus: "SYNCED" as const,
    programName: "German Language (B1)",
    batchCode: "B-GER-OCT-01",
    campus: "Main Campus",
    trainerName: "Dr. Markus S.",
    programType: "LANGUAGE" as const,
  },
];

const MOCK_ENROLLMENT_CATALOG: Record<
  string,
  Omit<LearnerActiveEnrollment, "id" | "status" | "joinedAt" | "completedAt">
> = {
  "B-GER-NOV": {
    batchId: "mock-batch-1",
    batchCode: "B-GER-NOV",
    batchName: "German B1 November Cohort",
    batchStatus: "IN_SESSION",
    campus: "Main Campus",
    startDate: new Date("2026-01-05T08:00:00Z").toISOString(),
    endDate: new Date("2026-06-05T08:00:00Z").toISOString(),
    mode: "OFFLINE",
    programId: "mock-program-1",
    programCode: "P-GER-001",
    programName: "German Language (B1)",
    programType: "LANGUAGE",
    courseCode: "C-GER-001",
    courseName: "German Language",
    trainerNames: ["Dr. Markus S."],
  },
  "B-CLI-OCT": {
    batchId: "mock-batch-2",
    batchCode: "B-CLI-OCT",
    batchName: "Clinical Bridging October Cohort",
    batchStatus: "IN_SESSION",
    campus: "South Wing",
    startDate: new Date("2026-02-01T09:00:00Z").toISOString(),
    endDate: new Date("2026-06-01T09:00:00Z").toISOString(),
    mode: "OFFLINE",
    programId: "mock-program-2",
    programCode: "P-CLI-001",
    programName: "Clinical Bridging",
    programType: "CLINICAL",
    courseCode: "C-CLI-001",
    courseName: "Clinical Foundations",
    trainerNames: ["Dr. Leena P."],
  },
  "B-GER-OCT-01": {
    batchId: "mock-batch-3",
    batchCode: "B-GER-OCT-01",
    batchName: "German B1 October Cohort 01",
    batchStatus: "IN_SESSION",
    campus: "Main Campus",
    startDate: new Date("2025-10-01T08:00:00Z").toISOString(),
    endDate: new Date("2026-03-15T08:00:00Z").toISOString(),
    mode: "OFFLINE",
    programId: "mock-program-1",
    programCode: "P-GER-001",
    programName: "German Language (B1)",
    programType: "LANGUAGE",
    courseCode: "C-GER-001",
    courseName: "German Language",
    trainerNames: ["Dr. Markus S."],
  },
  "B-TECH-APR": {
    batchId: "mock-batch-4",
    batchCode: "B-TECH-APR",
    batchName: "Healthcare IT April Cohort",
    batchStatus: "PLANNED",
    campus: "Innovation Hub",
    startDate: new Date("2026-04-15T10:00:00Z").toISOString(),
    endDate: new Date("2026-08-15T10:00:00Z").toISOString(),
    mode: "ONLINE",
    programId: "mock-program-3",
    programCode: "P-TECH-001",
    programName: "Healthcare IT Enablement",
    programType: "TECHNICAL",
    courseCode: "C-TECH-001",
    courseName: "Healthcare IT",
    trainerNames: ["Coach Priya Nair"],
  },
};

const MOCK_ACTIVE_ENROLLMENTS: Record<string, LearnerActiveEnrollment[]> = {
  "GTS-240901": [buildMockActiveEnrollment("B-GER-NOV", "240901-a"), buildMockActiveEnrollment("B-TECH-APR", "240901-b")],
  "GTS-240902": [buildMockActiveEnrollment("B-CLI-OCT", "240902-a")],
  "GTS-240903": [buildMockActiveEnrollment("B-GER-OCT-01", "240903-a")],
};

const learnerEnrollmentArgs = Prisma.validator<Prisma.BatchEnrollmentDefaultArgs>()({
  include: {
    batch: {
      include: {
        program: {
          include: {
            course: true,
          },
        },
        trainer: { include: { user: true } },
        trainers: { include: { user: true } },
      },
    },
  },
});

const learnerListArgs = Prisma.validator<Prisma.LearnerDefaultArgs>()({
  include: {
    enrollments: {
      where: { status: "ACTIVE" },
      orderBy: { joinedAt: "desc" },
      take: 1,
      include: learnerEnrollmentArgs.include,
    },
  },
});

const learnerDetailArgs = Prisma.validator<Prisma.LearnerDefaultArgs>()({
  include: {
    recruiterSyncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    enrollments: {
      where: { status: "ACTIVE" },
      orderBy: { joinedAt: "desc" },
      include: learnerEnrollmentArgs.include,
    },
  },
});

const batchDetailArgs = Prisma.validator<Prisma.BatchDefaultArgs>()({
  include: {
    program: {
      include: {
        course: true,
      },
    },
    trainer: { include: { user: true } },
    trainers: { include: { user: true } },
  },
});

type LearnerEnrollmentRecord = Prisma.BatchEnrollmentGetPayload<typeof learnerEnrollmentArgs>;
type LearnerDetailRecord = Prisma.LearnerGetPayload<typeof learnerDetailArgs>;

type LearnerWithEnrollments = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  latestAttendancePercentage: Prisma.Decimal;
  latestAssessmentAverage: Prisma.Decimal;
  readinessPercentage: number;
  placementStatus: LearnerListItem["placementStatus"];
  recruiterSyncStatus: LearnerListItem["recruiterSyncStatus"];
  enrollments: LearnerEnrollmentRecord[];
};

function buildMockActiveEnrollment(batchCode: string, idSuffix: string): LearnerActiveEnrollment {
  const batch = MOCK_ENROLLMENT_CATALOG[batchCode];

  if (!batch) {
    throw new Error(`Unknown mock batch code: ${batchCode}`);
  }

  return {
    id: `mock-enrollment-${idSuffix}`,
    status: "ACTIVE",
    joinedAt: batch.startDate,
    completedAt: null,
    ...batch,
  };
}

function getBatchTrainerNames(batch: LearnerEnrollmentRecord["batch"] | Prisma.BatchGetPayload<typeof batchDetailArgs>) {
  return Array.from(
    new Set(
      [batch.trainer?.user.name, ...batch.trainers.map((trainer) => trainer.user.name)].filter(
        (trainerName): trainerName is string => Boolean(trainerName),
      ),
    ),
  );
}

function mapEnrollmentToActiveEnrollment(enrollment: LearnerEnrollmentRecord): LearnerActiveEnrollment {
  return {
    id: enrollment.id,
    status: enrollment.status,
    joinedAt: enrollment.joinedAt.toISOString(),
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    batchId: enrollment.batch.id,
    batchCode: enrollment.batch.code,
    batchName: enrollment.batch.name,
    batchStatus: enrollment.batch.status,
    campus: enrollment.batch.campus,
    startDate: enrollment.batch.startDate.toISOString(),
    endDate: enrollment.batch.endDate?.toISOString() ?? null,
    mode: enrollment.batch.mode,
    programId: enrollment.batch.program.id,
    programCode: enrollment.batch.program.code,
    programName: enrollment.batch.program.name,
    programType: enrollment.batch.program.type,
    courseCode: enrollment.batch.program.course.code,
    courseName: enrollment.batch.program.course.name,
    trainerNames: getBatchTrainerNames(enrollment.batch),
  };
}

function mapLearnerToDetail(learner: LearnerDetailRecord): LearnerDetail {
  const base = mapLearnerToListItem(learner);

  return {
    ...base,
    phone: learner.phone,
    country: learner.country,
    softSkillsScore: learner.softSkillsScore,
    latestSyncMessage: learner.recruiterSyncLogs[0]?.message ?? null,
    activeEnrollments: learner.enrollments.map(mapEnrollmentToActiveEnrollment),
  };
}

/**
 * Converts a Prisma learner record into the lean table row shape.
 * Flattens active enrollment metadata needed by list views.
 * Keeps mapping logic isolated so DB schema changes are easier to contain.
 */
function mapLearnerToListItem(
  learner: LearnerWithEnrollments,
): LearnerListItem {
  const enrollment = learner.enrollments[0];
  const trainerNames = enrollment?.batch ? getBatchTrainerNames(enrollment.batch) : [];

  return {
    id: learner.id,
    learnerCode: learner.learnerCode,
    fullName: learner.fullName,
    email: learner.email,
    attendancePercentage: Number(learner.latestAttendancePercentage),
    averageScore: Number(learner.latestAssessmentAverage),
    readinessPercentage: learner.readinessPercentage,
    placementStatus: learner.placementStatus,
    recruiterSyncStatus: learner.recruiterSyncStatus,
    programName: enrollment?.batch.program.name ?? null,
    batchCode: enrollment?.batch.code ?? null,
    campus: enrollment?.batch.campus ?? null,
    trainerName: trainerNames.length > 0 ? trainerNames.join(", ") : null,
    programType: enrollment?.batch.program.type ?? null,
  };
}

/**
 * Sorts local mock learners using the same sort contract as DB queries.
 * Applies direction handling once to avoid duplicated comparison logic.
 * Preserves parity between mock mode and production mode table behavior.
 */
function sortMockLearners(items: LearnerListItem[], input: GetLearnersInput) {
  const direction = input.sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    switch (input.sortBy) {
      case "attendancePercentage":
        return (left.attendancePercentage - right.attendancePercentage) * direction;
      case "averageScore":
        return (left.averageScore - right.averageScore) * direction;
      case "readinessPercentage":
        return (left.readinessPercentage - right.readinessPercentage) * direction;
      default:
        return left.fullName.localeCompare(right.fullName) * direction;
    }
  });
}

/**
 * Builds a fully paginated learners response from in-memory fallback data.
 * Applies search, batch, and placement filters before pagination.
 * Mirrors production response structure so UI code is environment-agnostic.
 */
function buildMockLearnersResponse(input: GetLearnersInput): LearnersResponse {
  const filtered = MOCK_LEARNERS.filter((learner) => {
    const matchesSearch =
      input.search.length === 0 ||
      learner.fullName.toLowerCase().includes(input.search.toLowerCase()) ||
      learner.learnerCode.toLowerCase().includes(input.search.toLowerCase()) ||
      learner.email.toLowerCase().includes(input.search.toLowerCase());
    const matchesBatch = input.batchCode.length === 0 || learner.batchCode?.toLowerCase() === input.batchCode.toLowerCase();
    const matchesStatus = !input.placementStatus || learner.placementStatus === input.placementStatus;
    return matchesSearch && matchesBatch && matchesStatus;
  });

  const sorted = sortMockLearners(filtered, input);
  const start = (input.page - 1) * input.pageSize;
  const items = sorted.slice(start, start + input.pageSize);

  return {
    items,
    totalCount: sorted.length,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(sorted.length / input.pageSize)),
  };
}

/**
 * Produces a mock learner detail record for sheet and profile rendering.
 * Adds demo-only fields that are not present in the list response.
 * Returns null when the requested learner code does not exist in mocks.
 */
function buildMockLearnerDetail(learnerCode: string): LearnerDetail | null {
  const learner = MOCK_LEARNERS.find((entry) => entry.learnerCode === learnerCode);
  return learner
    ? {
        ...learner,
        phone: "+91 98765 43210",
        country: "India",
        softSkillsScore: 81,
        latestSyncMessage: learner.recruiterSyncStatus === "SYNCED" ? "Synced to Recruiter Workspace" : null,
        activeEnrollments: MOCK_ACTIVE_ENROLLMENTS[learner.learnerCode] ?? [],
      }
    : null;
}

function buildLearnerCodePrefix(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `GTS-${year}${month}${day}`;
}

function buildMockLearnerCode() {
  const prefix = buildLearnerCodePrefix();
  const suffix = String(Date.now()).slice(-4);
  return `${prefix}-${suffix}`;
}

async function generateLearnerCode() {
  const prefix = buildLearnerCodePrefix();
  const latestLearner = await prisma.learner.findFirst({
    where: {
      learnerCode: {
        startsWith: `${prefix}-`,
      },
    },
    orderBy: {
      learnerCode: "desc",
    },
    select: {
      learnerCode: true,
    },
  });

  const currentSequence = latestLearner?.learnerCode.match(/-(\d+)$/)?.[1];
  const nextSequence = (currentSequence ? Number(currentSequence) : 0) + 1;

  return `${prefix}-${String(nextSequence).padStart(2, "0")}`;
}

function isLearnerCodeConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetText.includes("learnerCode") || targetText.includes("candidate_code");
}

async function sendCandidateEnrollmentCredentialsEmail(input: {
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  learnerCode: string;
  programName: string;
}) {
  const appName = process.env.APP_NAME ?? "GTS Academy App";
  const loginUrl =
    process.env.CANDIDATE_APP_ORIGIN ?? process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN ?? "https://gts-acad.vercel.app";
  const supportEmail = process.env.ADMIN_MAIL ?? process.env.MAIL_FROM_ADDRESS ?? "support@gts-academy.test";

  const template = await renderEmailTemplateByKeyService(CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY, {
    appName,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    temporaryPassword: input.temporaryPassword,
    loginUrl,
    supportEmail,
    learnerCode: input.learnerCode,
    programName: input.programName,
  });

  await deliverLoggedEmail({
    to: input.recipientEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "CANDIDATE_WELCOME",
    templateKey: CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    audit: {
      entityType: "CANDIDATE",
      entityId: input.learnerCode,
    },
  });
}

/**
 * Fetches learner list data with filters, sorting, and pagination controls.
 * Runs Prisma queries in configured environments and mock logic otherwise.
 * Guarantees a stable response object for table and URL-driven state.
 */
export async function getLearnersService(input: GetLearnersInput): Promise<LearnersResponse> {
  const sortMap: Record<GetLearnersInput["sortBy"], Prisma.LearnerOrderByWithRelationInput> = {
    fullName: { fullName: input.sortDirection },
    attendancePercentage: { latestAttendancePercentage: input.sortDirection },
    averageScore: { latestAssessmentAverage: input.sortDirection },
    readinessPercentage: { readinessPercentage: input.sortDirection },
  };

  const where: Prisma.LearnerWhereInput = {
    ...(input.search
      ? {
          OR: [
            { fullName: { contains: input.search, mode: "insensitive" } },
            { learnerCode: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.placementStatus ? { placementStatus: input.placementStatus } : {}),
    ...(input.batchCode
      ? {
          enrollments: {
            some: {
              status: "ACTIVE",
              batch: {
                code: { equals: input.batchCode, mode: "insensitive" },
              },
            },
          },
        }
      : {}),
  };

  if (!isDatabaseConfigured) {
    return buildMockLearnersResponse(input);
  }

  try {
    const [totalCount, learners] = await prisma.$transaction([
      prisma.learner.count({ where }),
      prisma.learner.findMany({
        where,
        orderBy: sortMap[input.sortBy],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        ...learnerListArgs,
      }),
    ]);

    return {
      items: learners.map(mapLearnerToListItem),
      totalCount,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
    };
  } catch (error) {
    console.warn("Learner query fallback activated", error);
    return buildMockLearnersResponse(input);
  }
}

export type LearnerSearchItem = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  programName: string | null;
  batchCode: string | null;
};

export type CandidateProfile = LearnerDetail & {
  userId: string;
  role: string;
  pathway: string;
};

export async function searchLearnersService(query: string, limit: number): Promise<LearnerSearchItem[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_LEARNERS.filter(
      (l) =>
        l.fullName.toLowerCase().includes(normalizedQuery) ||
        l.learnerCode.toLowerCase().includes(normalizedQuery) ||
        l.email.toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        learnerCode: l.learnerCode,
        fullName: l.fullName,
        email: l.email,
        programName: l.programName,
        batchCode: l.batchCode,
      }));
  }

  try {
    const learners = await prisma.learner.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { learnerCode: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        learnerCode: true,
        fullName: true,
        email: true,
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          take: 1,
          select: {
            batch: {
              select: {
                code: true,
                program: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return learners.map((l) => {
      const enrollment = l.enrollments[0] ?? null;
      return {
        id: l.id,
        learnerCode: l.learnerCode,
        fullName: l.fullName,
        email: l.email,
        programName: enrollment?.batch.program.name ?? null,
        batchCode: enrollment?.batch.code ?? null,
      };
    });
  } catch (error) {
    console.warn("Learner search fallback activated", error);
    return MOCK_LEARNERS.filter(
      (l) =>
        l.fullName.toLowerCase().includes(normalizedQuery) ||
        l.learnerCode.toLowerCase().includes(normalizedQuery) ||
        l.email.toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        learnerCode: l.learnerCode,
        fullName: l.fullName,
        email: l.email,
        programName: l.programName,
        batchCode: l.batchCode,
      }));
  }
}

/**
 * Fetches a single learner detail payload by unique learner code.
 * Supports both Prisma-backed retrieval and mock fallback behavior.
 * Returns null when the learner does not exist in the selected data source.
 */
export async function getLearnerByCodeService(learnerCode: string): Promise<LearnerDetail | null> {
  if (!isDatabaseConfigured) {
    return buildMockLearnerDetail(learnerCode);
  }

  try {
    const learner = await prisma.learner.findUnique({ where: { learnerCode }, ...learnerDetailArgs });

    if (!learner) {
      return null;
    }

    return mapLearnerToDetail(learner);
  } catch (error) {
    console.warn("Learner detail fallback activated", error);
    return buildMockLearnerDetail(learnerCode);
  }
}

export async function getCandidateProfileByUserIdService(userId: string): Promise<CandidateProfile | null> {
  if (!isDatabaseConfigured) {
    const mockLearner = buildMockLearnerDetail("GTS-240901");

    if (!mockLearner) {
      return null;
    }

    return {
      ...mockLearner,
      userId,
      role: "CANDIDATE",
      pathway: "Germany Pathway",
    };
  }

  try {
    const learner = await prisma.learner.findFirst({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
        recruiterSyncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          include: learnerEnrollmentArgs.include,
        },
      },
    });

    if (!learner || !learner.user?.id) {
      return null;
    }

    const activeEnrollment = learner.enrollments[0] ?? null;
    const pathway =
      [learner.targetCountry, learner.targetLanguage].filter((value): value is string => Boolean(value && value.trim().length > 0)).join(" / ") ||
      activeEnrollment?.batch.program.name ||
      "Candidate Pathway";

    return {
      ...mapLearnerToDetail(learner),
      userId: learner.user.id,
      role: "CANDIDATE",
      pathway,
    };
  } catch (error) {
    console.warn("Candidate profile query fallback activated", error);
    return null;
  }
}

/**
 * Creates a learner candidate and optionally enrolls them into a batch.
 * Generates a unique learner code server-side and enforces email uniqueness.
 * Returns the created learner shape used by list and detail consumers.
 */
export async function createLearnerService(input: CreateLearnerInput): Promise<LearnerDetail> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedFullName = input.fullName.trim();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedCampus = input.campus.trim() || null;
  const normalizedProgramName = input.programName.trim();
  const normalizedBatchCode = input.batchCode.trim();

  if (!isDatabaseConfigured) {
    const nowId = `mock-${Date.now()}`;
    const activeEnrollments = normalizedBatchCode ? [buildMockActiveEnrollment(normalizedBatchCode, nowId)] : [];

    return {
      id: nowId,
      learnerCode: buildMockLearnerCode(),
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      country: normalizedCampus,
      attendancePercentage: 0,
      averageScore: 0,
      readinessPercentage: 0,
      placementStatus: "NOT_READY",
      recruiterSyncStatus: "NOT_SYNCED",
      programName: normalizedProgramName,
      batchCode: normalizedBatchCode || null,
      campus: normalizedCampus,
      trainerName: null,
      programType: null,
      softSkillsScore: 0,
      latestSyncMessage: null,
      activeEnrollments,
    };
  }

  const [existingLearnerEmail, existingUserEmail] = await Promise.all([
    prisma.learner.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
  ]);

  if (existingLearnerEmail) {
    throw new Error("Email already exists.");
  }

  if (existingUserEmail) {
    throw new Error("A user account already exists with this email.");
  }

  const batch = normalizedBatchCode
    ? await prisma.batch.findFirst({
        where: { code: { equals: normalizedBatchCode, mode: "insensitive" } },
        select: { id: true },
      })
    : null;

  if (normalizedBatchCode && !batch) {
    throw new Error("Invalid batch code.");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generatedLearnerCode = await generateLearnerCode();
    const temporaryPassword = randomUUID();
    const hashedTemporaryPassword = await hashPassword(temporaryPassword);

    try {
      const createdResult = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: normalizedFullName,
            phone: normalizedPhone,
            password: hashedTemporaryPassword,
            isActive: true,
            metadata: {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: generatedLearnerCode,
              welcomeCredentialsEmailStatus: "pending",
            },
          },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });

        await tx.userSecurity.create({
          data: {
            userId: createdUser.id,
            twoFactorEnabled: false,
            recoveryCodes: [],
          },
        });

        const created = await tx.learner.create({
          data: {
            userId: createdUser.id,
            learnerCode: generatedLearnerCode,
            fullName: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone,
            country: normalizedCampus,
          },
          select: { id: true },
        });

        if (batch) {
          await tx.batchEnrollment.create({
            data: {
              learnerId: created.id,
              batchId: batch.id,
              status: "ACTIVE",
            },
          });
        }

        return {
          learnerId: created.id,
          learnerCode: generatedLearnerCode,
          createdUser,
        };
      }, { maxWait: 10_000, timeout: 15_000 });

      const candidateRole = await prisma.role.findUnique({ where: { code: "CANDIDATE" } });
      if (candidateRole) {
        await addRoleToUser(createdResult.createdUser.id, candidateRole.id);
      }

      const learner = await prisma.learner.findUniqueOrThrow({
        where: { id: createdResult.learnerId },
        ...learnerDetailArgs,
      });

      try {
        await sendCandidateEnrollmentCredentialsEmail({
          recipientEmail: createdResult.createdUser.email,
          recipientName: createdResult.createdUser.name,
          temporaryPassword,
          learnerCode: createdResult.learnerCode,
          programName: normalizedProgramName,
        });

        await prisma.user.update({
          where: { id: createdResult.createdUser.id },
          data: {
            metadata: {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: createdResult.learnerCode,
              welcomeCredentialsEmailStatus: "sent",
            },
          },
        });
      } catch (mailError) {
        console.error("Candidate welcome email dispatch failed", {
          learnerCode: createdResult.learnerCode,
          email: createdResult.createdUser.email,
          error: mailError,
        });

        await prisma.user.update({
          where: { id: createdResult.createdUser.id },
          data: {
            metadata: {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: createdResult.learnerCode,
              welcomeCredentialsEmailStatus: "failed",
            },
          },
        });
      }

      const mappedLearner = mapLearnerToDetail(learner);

      await createAuditLogEntry({
        entityType: AuditEntityType.CANDIDATE,
        entityId: mappedLearner.id,
        action: AuditActionType.CREATED,
        message: `Candidate ${mappedLearner.learnerCode} created from enrollment flow.`,
        metadata: {
          learnerCode: mappedLearner.learnerCode,
          email: mappedLearner.email,
          batchCode: normalizedBatchCode || null,
        },
      });

      if (normalizedBatchCode) {
        await createAuditLogEntry({
          entityType: AuditEntityType.BATCH,
          entityId: normalizedBatchCode,
          action: AuditActionType.ENROLLED,
          message: `Candidate ${mappedLearner.learnerCode} enrolled into batch ${normalizedBatchCode}.`,
          metadata: {
            learnerCode: mappedLearner.learnerCode,
            learnerId: mappedLearner.id,
            batchCode: normalizedBatchCode,
          },
        });
      }

      return mappedLearner;
    } catch (error) {
      if (isLearnerCodeConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate learner code.");
}

export async function addLearnerEnrollmentService(learnerCode: string, input: CreateLearnerEnrollmentInput): Promise<LearnerDetail> {
  const normalizedLearnerCode = learnerCode.trim();
  const normalizedBatchCode = input.batchCode.trim();

  if (!isDatabaseConfigured) {
    const learner = buildMockLearnerDetail(normalizedLearnerCode);

    if (!learner) {
      throw new Error("Learner not found.");
    }

    const existingEnrollment = learner.activeEnrollments.find(
      (enrollment) => enrollment.batchCode.toLowerCase() === normalizedBatchCode.toLowerCase(),
    );

    if (existingEnrollment) {
      throw new Error("Learner is already enrolled in this batch.");
    }

    const mockEnrollment = Object.entries(MOCK_ENROLLMENT_CATALOG).find(
      ([batchCode]) => batchCode.toLowerCase() === normalizedBatchCode.toLowerCase(),
    );

    if (!mockEnrollment) {
      throw new Error("Invalid batch code.");
    }

    return {
      ...learner,
      activeEnrollments: [buildMockActiveEnrollment(mockEnrollment[0], `${learner.learnerCode}-new`), ...learner.activeEnrollments],
    };
  }

  try {
    const learner = await prisma.$transaction(async (tx) => {
      const learnerRecord = await tx.learner.findUnique({
        where: { learnerCode: normalizedLearnerCode },
        select: { id: true },
      });

      if (!learnerRecord) {
        throw new Error("Learner not found.");
      }

      const batch = await tx.batch.findFirst({
        where: {
          code: { equals: normalizedBatchCode, mode: "insensitive" },
        },
        ...batchDetailArgs,
      });

      if (!batch) {
        throw new Error("Invalid batch code.");
      }

      if (batch.status !== "PLANNED" && batch.status !== "IN_SESSION") {
        throw new Error("Only planned or in-session batches can accept enrollments.");
      }

      const existingEnrollment = await tx.batchEnrollment.findFirst({
        where: {
          learnerId: learnerRecord.id,
          batchId: batch.id,
        },
        select: {
          id: true,
        },
      });

      if (existingEnrollment) {
        throw new Error("Learner is already enrolled in this batch.");
      }

      await tx.batchEnrollment.create({
        data: {
          learnerId: learnerRecord.id,
          batchId: batch.id,
          status: "ACTIVE",
        },
      });

      return tx.learner.findUniqueOrThrow({ where: { id: learnerRecord.id }, ...learnerDetailArgs });
    }, { maxWait: 10_000, timeout: 15_000 });

    const mappedLearner = mapLearnerToDetail(learner);

    await createAuditLogEntry({
      entityType: AuditEntityType.BATCH,
      entityId: normalizedBatchCode,
      action: AuditActionType.ENROLLED,
      message: `Candidate ${mappedLearner.learnerCode} enrolled into batch ${normalizedBatchCode}.`,
      metadata: {
        learnerCode: mappedLearner.learnerCode,
        learnerId: mappedLearner.id,
        batchCode: normalizedBatchCode,
      },
    });

    return mappedLearner;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Learner is already enrolled in this batch.");
    }

    throw error;
  }
}