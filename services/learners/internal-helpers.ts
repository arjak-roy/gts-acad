import { Prisma } from "@prisma/client";

import { CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { prisma } from "@/lib/prisma-client";
import { GetLearnersInput } from "@/lib/validation-schemas/learners";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";
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

export const learnerEnrollmentArgs = Prisma.validator<Prisma.BatchEnrollmentDefaultArgs>()({
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

export const learnerListArgs = Prisma.validator<Prisma.LearnerDefaultArgs>()({
  include: {
    enrollments: {
      where: { status: "ACTIVE" },
      orderBy: { joinedAt: "desc" },
      take: 1,
      include: learnerEnrollmentArgs.include,
    },
  },
});

export const learnerDetailArgs = Prisma.validator<Prisma.LearnerDefaultArgs>()({
  include: {
    recruiterSyncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    enrollments: {
      where: { status: "ACTIVE" },
      orderBy: { joinedAt: "desc" },
      include: learnerEnrollmentArgs.include,
    },
  },
});

export const batchDetailArgs = Prisma.validator<Prisma.BatchDefaultArgs>()({
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

export type LearnerEnrollmentRecord = Prisma.BatchEnrollmentGetPayload<typeof learnerEnrollmentArgs>;
export type LearnerDetailRecord = Prisma.LearnerGetPayload<typeof learnerDetailArgs>;

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

export function buildMockActiveEnrollment(batchCode: string, idSuffix: string): LearnerActiveEnrollment {
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

export function getBatchTrainerNames(batch: LearnerEnrollmentRecord["batch"] | Prisma.BatchGetPayload<typeof batchDetailArgs>) {
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

export function mapLearnerToDetail(learner: LearnerDetailRecord): LearnerDetail {
  const base = mapLearnerToListItem(learner);

  return {
    ...base,
    phone: learner.phone,
    country: learner.country,
    dob: learner.dob?.toISOString() ?? null,
    gender: learner.gender,
    targetCountry: learner.targetCountry,
    targetLanguage: learner.targetLanguage,
    targetExam: learner.targetExam,
    softSkillsScore: learner.softSkillsScore,
    latestSyncMessage: learner.recruiterSyncLogs[0]?.message ?? null,
    activeEnrollments: learner.enrollments.map(mapEnrollmentToActiveEnrollment),
  };
}

export function mapLearnerToListItem(learner: LearnerWithEnrollments): LearnerListItem {
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

export function buildMockLearnersResponse(input: GetLearnersInput): LearnersResponse {
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

export function buildMockLearnerDetail(learnerCode: string): LearnerDetail | null {
  const learner = MOCK_LEARNERS.find((entry) => entry.learnerCode === learnerCode);
  return learner
    ? {
        ...learner,
        phone: "+91 98765 43210",
        country: "India",
        dob: "2001-01-01T00:00:00.000Z",
        gender: "Female",
        targetCountry: "Germany",
        targetLanguage: "German",
        targetExam: "GOETHE_B1",
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

export function buildMockLearnerCode() {
  const prefix = buildLearnerCodePrefix();
  const suffix = String(Date.now()).slice(-4);
  return `${prefix}-${suffix}`;
}

export async function generateLearnerCode() {
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

export function isLearnerCodeConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetText.includes("learnerCode") || targetText.includes("candidate_code");
}

export async function sendCandidateEnrollmentCredentialsEmail(input: {
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  learnerCode: string;
  programName: string;
}) {
  const generalSettings = await getGeneralRuntimeSettings();
  const normalizeOrigin = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    if (/^https?:\/\//i.test(normalized)) {
      return normalized.replace(/\/$/, "");
    }

    return `https://${normalized}`.replace(/\/$/, "");
  };

  const candidateOrigin =
    normalizeOrigin(process.env.CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(generalSettings.applicationUrl) ??
    "https://gts-acad.vercel.app";

  const template = await renderEmailTemplateByKeyService(CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    temporaryPassword: input.temporaryPassword,
    loginUrl: `${candidateOrigin}/login`,
    supportEmail: generalSettings.supportEmail,
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

export { MOCK_ENROLLMENT_CATALOG, MOCK_LEARNERS };
