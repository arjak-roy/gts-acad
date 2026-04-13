import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import {
  ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY,
  BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY,
  BUDDY_EMAIL_ACTION_EMAIL_TEMPLATE_KEY,
  BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY,
  COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY,
} from "@/lib/mail-templates/email-template-defaults";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";

type BatchEventNotificationInput = {
  batchId: string;
  actorUserId?: string | null;
  events: Array<{
    id: string;
    title: string;
    type: string;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    meetingUrl: string | null;
  }>;
};

type AssessmentScheduledNotificationInput = {
  batchId: string;
  actorUserId?: string | null;
  events: Array<{
    id: string;
    title: string;
    type: string;
    startsAt: Date;
    meetingUrl: string | null;
    linkedAssessmentPoolId: string | null;
  }>;
};

type CandidateRecipient = {
  learnerId: string;
  learnerCode: string;
  recipientName: string;
  recipientEmail: string;
};

type BuddyEmailActionTarget = "ACADEMY_SUPPORT" | "TRAINER";

type BuddyEmailActionRecipient = {
  recipientName: string;
  recipientEmail: string;
  recipientUserId: string | null;
  targetLabel: string;
};

export type CandidateNotificationDispatchSummary = {
  attemptedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  failureMessages: string[];
};

const NOTIFICATION_DISPATCH_CONCURRENCY = 5;
const MAX_NOTIFICATION_FAILURE_MESSAGES = 5;

function normalizeOrigin(value: string | undefined | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/$/, "");
  }

  return `https://${normalized}`.replace(/\/$/, "");
}

async function getCandidatePortalContext() {
  const generalSettings = await getGeneralRuntimeSettings();
  const candidateOrigin =
    normalizeOrigin(process.env.CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(generalSettings.applicationUrl) ??
    "https://candidate.gts-academy.app";

  return {
    appName: generalSettings.applicationName,
    supportEmail: generalSettings.supportEmail,
    timeZone: generalSettings.timeZone,
    portalUrl: candidateOrigin,
    loginUrl: `${candidateOrigin}/login`,
  };
}

type CandidatePortalContext = Awaited<ReturnType<typeof getCandidatePortalContext>>;

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) {
    return "To be announced";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

function formatDate(value: Date | null, timeZone: string) {
  if (!value) {
    return "To be announced";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone,
  }).format(value);
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) {
    return "Not specified";
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  }

  return `${minutes} minutes`;
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function buildScoreSummary(marksObtained: number | null, totalMarks: number, percentage: number | null) {
  const percentageText = percentage === null ? "Pending" : `${percentage}%`;
  const marksText = marksObtained === null ? `/${totalMarks}` : `${marksObtained}/${totalMarks}`;
  return `${percentageText} (${marksText})`;
}

function buildResultStatus(passed: boolean | null) {
  if (passed === true) {
    return "Passed";
  }

  if (passed === false) {
    return "Needs improvement";
  }

  return "Result available";
}

async function sendCandidateTemplateEmail(input: {
  templateKey: string;
  recipient: CandidateRecipient;
  actorUserId?: string | null;
  variables: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  portalContext?: CandidatePortalContext;
}) {
  const portalContext = input.portalContext ?? (await getCandidatePortalContext());
  const template = await renderEmailTemplateByKeyService(input.templateKey, {
    appName: portalContext.appName,
    recipientName: input.recipient.recipientName,
    portalUrl: portalContext.portalUrl,
    loginUrl: portalContext.loginUrl,
    supportEmail: portalContext.supportEmail,
    ...input.variables,
  });

  await deliverLoggedEmail({
    to: input.recipient.recipientEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: input.templateKey,
    metadata: {
      learnerId: input.recipient.learnerId,
      learnerCode: input.recipient.learnerCode,
      ...input.metadata,
    },
    audit: {
      entityType: "CANDIDATE",
      entityId: input.recipient.learnerId,
      actorUserId: input.actorUserId ?? null,
    },
  });
}

function createNotificationDispatchSummary(
  input?: Partial<CandidateNotificationDispatchSummary>,
): CandidateNotificationDispatchSummary {
  return {
    attemptedCount: input?.attemptedCount ?? 0,
    sentCount: input?.sentCount ?? 0,
    failedCount: input?.failedCount ?? 0,
    skippedCount: input?.skippedCount ?? 0,
    failureMessages: input?.failureMessages ?? [],
  };
}

function mergeNotificationDispatchSummaries(
  ...summaries: CandidateNotificationDispatchSummary[]
): CandidateNotificationDispatchSummary {
  return summaries.reduce(
    (aggregate, summary) => ({
      attemptedCount: aggregate.attemptedCount + summary.attemptedCount,
      sentCount: aggregate.sentCount + summary.sentCount,
      failedCount: aggregate.failedCount + summary.failedCount,
      skippedCount: aggregate.skippedCount + summary.skippedCount,
      failureMessages: [...aggregate.failureMessages, ...summary.failureMessages].slice(0, MAX_NOTIFICATION_FAILURE_MESSAGES),
    }),
    createNotificationDispatchSummary(),
  );
}

async function dispatchCandidateNotificationTasks(
  tasks: Array<{
    label: string;
    run: () => Promise<void>;
  }>,
): Promise<CandidateNotificationDispatchSummary> {
  if (tasks.length === 0) {
    return createNotificationDispatchSummary();
  }

  let sentCount = 0;
  let failedCount = 0;
  const failureMessages: string[] = [];

  for (let index = 0; index < tasks.length; index += NOTIFICATION_DISPATCH_CONCURRENCY) {
    const chunk = tasks.slice(index, index + NOTIFICATION_DISPATCH_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((task) => task.run()));

    settled.forEach((result, offset) => {
      if (result.status === "fulfilled") {
        sentCount += 1;
        return;
      }

      failedCount += 1;

      if (failureMessages.length < MAX_NOTIFICATION_FAILURE_MESSAGES) {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failureMessages.push(`${chunk[offset]?.label ?? "notification"}: ${reason}`);
      }
    });
  }

  return createNotificationDispatchSummary({
    attemptedCount: tasks.length,
    sentCount,
    failedCount,
    failureMessages,
  });
}

async function resolveCandidateRecipient(learnerId: string): Promise<CandidateRecipient | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: {
      id: true,
      learnerCode: true,
      fullName: true,
      email: true,
      isActive: true,
    },
  });

  if (!learner || !learner.isActive) {
    return null;
  }

  return {
    learnerId: learner.id,
    learnerCode: learner.learnerCode,
    recipientName: learner.fullName,
    recipientEmail: learner.email,
  };
}

async function resolveActiveBatchRecipients(batchId: string): Promise<{
  batchCode: string;
  batchName: string;
  programName: string;
  courseName: string;
  recipients: CandidateRecipient[];
} | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      code: true,
      name: true,
      program: {
        select: {
          name: true,
          course: {
            select: {
              name: true,
            },
          },
        },
      },
      enrollments: {
        where: {
          status: "ACTIVE",
          learner: {
            is: {
              isActive: true,
            },
          },
        },
        select: {
          learner: {
            select: {
              id: true,
              learnerCode: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return null;
  }

  const recipients = Array.from(
    new Map(
      batch.enrollments.map((enrollment) => [
        enrollment.learner.id,
        {
          learnerId: enrollment.learner.id,
          learnerCode: enrollment.learner.learnerCode,
          recipientName: enrollment.learner.fullName,
          recipientEmail: enrollment.learner.email,
        } satisfies CandidateRecipient,
      ]),
    ).values(),
  );

  return {
    batchCode: batch.code,
    batchName: batch.name,
    programName: batch.program.name,
    courseName: batch.program.course.name,
    recipients,
  };
}

async function resolveBuddyEmailActionRecipient(
  batchId: string,
  target: BuddyEmailActionTarget,
  portalContext: CandidatePortalContext,
): Promise<BuddyEmailActionRecipient> {
  if (target === "ACADEMY_SUPPORT") {
    const supportEmail = portalContext.supportEmail.trim();

    if (!supportEmail) {
      throw new Error("Support email is not configured.");
    }

    return {
      recipientName: "Academy Support",
      recipientEmail: supportEmail,
      recipientUserId: null,
      targetLabel: "academy support",
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      trainer: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      trainers: {
        where: {
          isActive: true,
        },
        take: 1,
        orderBy: {
          joinedAt: "asc",
        },
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const trainer = batch?.trainer ?? batch?.trainers[0] ?? null;
  const trainerEmail = trainer?.user.email?.trim() ?? "";

  if (!trainer || !trainerEmail) {
    throw new Error("Assigned trainer contact is not available for this batch.");
  }

  return {
    recipientName: trainer.user.name?.trim() || "Assigned Trainer",
    recipientEmail: trainerEmail,
    recipientUserId: trainer.userId,
    targetLabel: "assigned trainer",
  };
}

export async function sendCandidateCourseEnrollmentNotification(input: {
  learnerId: string;
  actorUserId?: string | null;
  batchId?: string | null;
  batchCode?: string | null;
}) {
  if (!isDatabaseConfigured) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  const portalContext = await getCandidatePortalContext();
  const learner = await prisma.learner.findUnique({
    where: { id: input.learnerId },
    select: {
      id: true,
      learnerCode: true,
      fullName: true,
      email: true,
      isActive: true,
      enrollments: {
        where: {
          status: "ACTIVE",
          ...(input.batchId ? { batchId: input.batchId } : {}),
          ...(input.batchCode
            ? {
                batch: {
                  is: {
                    code: { equals: input.batchCode, mode: "insensitive" },
                  },
                },
              }
            : {}),
        },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: {
          batchId: true,
          batch: {
            select: {
              code: true,
              name: true,
              startDate: true,
              program: {
                select: {
                  name: true,
                  course: {
                    select: {
                      name: true,
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

  if (!learner || !learner.isActive) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  const enrollment = learner.enrollments[0];
  if (!enrollment) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  return dispatchCandidateNotificationTasks([
    {
      label: `course-enrollment:${learner.learnerCode}`,
      run: () =>
        sendCandidateTemplateEmail({
          templateKey: COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY,
          recipient: {
            learnerId: learner.id,
            learnerCode: learner.learnerCode,
            recipientName: learner.fullName,
            recipientEmail: learner.email,
          },
          actorUserId: input.actorUserId,
          portalContext,
          variables: {
            courseName: enrollment.batch.program.course.name,
            programName: enrollment.batch.program.name,
            batchName: enrollment.batch.name,
            startDate: formatDate(enrollment.batch.startDate, portalContext.timeZone),
            loginUrl: portalContext.loginUrl,
          },
          metadata: {
            batchId: enrollment.batchId,
            batchCode: enrollment.batch.code,
            courseName: enrollment.batch.program.course.name,
          },
        }),
    },
  ]);
}

export async function sendCandidateBuddyPersonaAvailableNotification(input: {
  learnerId: string;
  batchId: string;
  buddyPersonaName: string;
  buddyLanguage: string;
  actorUserId?: string | null;
}) {
  if (!isDatabaseConfigured) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  const portalContext = await getCandidatePortalContext();
  const [recipient, batchContext] = await Promise.all([
    resolveCandidateRecipient(input.learnerId),
    getBatchCourseContext(input.batchId),
  ]);

  if (!recipient || !batchContext) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  return dispatchCandidateNotificationTasks([
    {
      label: `buddy-persona:${recipient.learnerCode}:${input.batchId}`,
      run: () =>
        sendCandidateTemplateEmail({
          templateKey: BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY,
          recipient,
          actorUserId: input.actorUserId,
          portalContext,
          variables: {
            buddyPersonaName: input.buddyPersonaName,
            buddyLanguage: input.buddyLanguage,
            courseName: batchContext.courseName,
            programName: batchContext.programName,
            batchName: batchContext.batchName,
            loginUrl: portalContext.loginUrl,
          },
          metadata: {
            batchId: batchContext.batchId,
            batchCode: batchContext.batchCode,
            courseName: batchContext.courseName,
            buddyPersonaName: input.buddyPersonaName,
          },
        }),
    },
  ]);
}

export async function sendCandidateBuddyEmailActionNotification(input: {
  learnerId: string;
  batchId: string;
  buddyPersonaName: string;
  senderName: string;
  senderLearnerCode: string;
  senderEmail: string;
  target: BuddyEmailActionTarget;
  emailSubject: string;
  candidateMessage: string;
  actorUserId?: string | null;
}) {
  if (!isDatabaseConfigured) {
    throw new Error("Buddy email actions require a configured database.");
  }

  const portalContext = await getCandidatePortalContext();
  const [batchContext, recipient] = await Promise.all([
    getBatchCourseContext(input.batchId),
    resolveBuddyEmailActionRecipient(input.batchId, input.target, portalContext),
  ]);

  if (!batchContext) {
    throw new Error("Batch not found.");
  }

  const template = await renderEmailTemplateByKeyService(BUDDY_EMAIL_ACTION_EMAIL_TEMPLATE_KEY, {
    appName: portalContext.appName,
    recipientName: recipient.recipientName,
    portalUrl: portalContext.portalUrl,
    loginUrl: portalContext.loginUrl,
    supportEmail: portalContext.supportEmail,
    targetLabel: recipient.targetLabel,
    buddyPersonaName: input.buddyPersonaName,
    senderName: input.senderName,
    senderLearnerCode: input.senderLearnerCode,
    senderEmail: input.senderEmail,
    courseName: batchContext.courseName,
    programName: batchContext.programName,
    batchName: batchContext.batchName,
    emailSubject: input.emailSubject,
    candidateMessage: input.candidateMessage,
  });

  await deliverLoggedEmail({
    to: recipient.recipientEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: BUDDY_EMAIL_ACTION_EMAIL_TEMPLATE_KEY,
    metadata: {
      learnerId: input.learnerId,
      senderLearnerCode: input.senderLearnerCode,
      senderEmail: input.senderEmail,
      batchId: batchContext.batchId,
      batchCode: batchContext.batchCode,
      courseName: batchContext.courseName,
      programName: batchContext.programName,
      buddyPersonaName: input.buddyPersonaName,
      buddyEmailActionTarget: input.target,
      buddyEmailActionTargetLabel: recipient.targetLabel,
      buddyEmailActionRecipientName: recipient.recipientName,
      buddyEmailActionRecipientEmail: recipient.recipientEmail,
      buddyEmailActionRecipientUserId: recipient.recipientUserId,
      emailSubject: input.emailSubject,
    },
    audit: {
      entityType: "CANDIDATE",
      entityId: input.learnerId,
      actorUserId: input.actorUserId ?? null,
    },
  });

  return {
    target: input.target,
    targetLabel: recipient.targetLabel,
    recipientName: recipient.recipientName,
  };
}

export async function sendCandidateBatchEventNotifications(input: BatchEventNotificationInput) {
  if (!isDatabaseConfigured || input.events.length === 0) {
    return createNotificationDispatchSummary();
  }

  const portalContext = await getCandidatePortalContext();
  const batch = await resolveActiveBatchRecipients(input.batchId);

  if (!batch || batch.recipients.length === 0) {
    return createNotificationDispatchSummary({ skippedCount: input.events.length });
  }

  return dispatchCandidateNotificationTasks(
    batch.recipients.flatMap((recipient) =>
      input.events.map((event) => ({
        label: `batch-event:${recipient.learnerCode}:${event.id}`,
        run: () =>
          sendCandidateTemplateEmail({
            templateKey: BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY,
            recipient,
            actorUserId: input.actorUserId,
            portalContext,
            variables: {
              eventTitle: event.title,
              eventType: formatLabel(event.type),
              courseName: batch.courseName,
              programName: batch.programName,
              batchName: batch.batchName,
              startsAt: formatDateTime(event.startsAt, portalContext.timeZone),
              endsAt: formatDateTime(event.endsAt, portalContext.timeZone),
              location: fallbackText(event.location, "To be announced"),
              meetingUrl: fallbackText(event.meetingUrl, "Not provided"),
            },
            metadata: {
              batchId: input.batchId,
              batchCode: batch.batchCode,
              eventId: event.id,
              eventType: event.type,
            },
          }),
      })),
    ),
  );
}

export async function sendCandidateAssessmentScheduledNotifications(input: AssessmentScheduledNotificationInput) {
  if (!isDatabaseConfigured || input.events.length === 0) {
    return createNotificationDispatchSummary();
  }

  const portalContext = await getCandidatePortalContext();
  const batch = await resolveActiveBatchRecipients(input.batchId);

  if (!batch || batch.recipients.length === 0) {
    return createNotificationDispatchSummary({ skippedCount: input.events.length });
  }

  const assessmentPoolIds = Array.from(new Set(input.events.map((event) => event.linkedAssessmentPoolId).filter(Boolean))) as string[];
  const assessmentPools = assessmentPoolIds.length > 0
    ? await prisma.assessmentPool.findMany({
        where: {
          id: {
            in: assessmentPoolIds,
          },
        },
        select: {
          id: true,
          title: true,
          timeLimitMinutes: true,
        },
      })
    : [];
  const assessmentPoolMap = new Map(assessmentPools.map((pool) => [pool.id, pool]));

  return dispatchCandidateNotificationTasks(
    batch.recipients.flatMap((recipient) =>
      input.events.map((event) => {
        const pool = event.linkedAssessmentPoolId ? assessmentPoolMap.get(event.linkedAssessmentPoolId) ?? null : null;

        return {
          label: `assessment-scheduled:${recipient.learnerCode}:${event.id}`,
          run: () =>
            sendCandidateTemplateEmail({
              templateKey: ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY,
              recipient,
              actorUserId: input.actorUserId,
              portalContext,
              variables: {
                assessmentTitle: pool?.title ?? event.title,
                assessmentType: formatLabel(event.type),
                courseName: batch.courseName,
                programName: batch.programName,
                batchName: batch.batchName,
                scheduledAt: formatDateTime(event.startsAt, portalContext.timeZone),
                timeLimit: formatDuration(pool?.timeLimitMinutes),
                meetingUrl: fallbackText(event.meetingUrl, "Not provided"),
              },
              metadata: {
                batchId: input.batchId,
                batchCode: batch.batchCode,
                eventId: event.id,
                assessmentPoolId: event.linkedAssessmentPoolId,
              },
            }),
        };
      }),
    ),
  );
}

export async function sendCandidateAssessmentCompletionNotification(input: {
  learnerId: string;
  batchId: string;
  assessmentTitle: string;
  submittedAt: Date;
  requiresManualReview: boolean;
  actorUserId?: string | null;
}) {
  if (!isDatabaseConfigured) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  const portalContext = await getCandidatePortalContext();
  const [recipient, batchContext] = await Promise.all([
    resolveCandidateRecipient(input.learnerId),
    getBatchCourseContext(input.batchId),
  ]);

  if (!recipient || !batchContext) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  return dispatchCandidateNotificationTasks([
    {
      label: `assessment-completed:${recipient.learnerCode}:${input.batchId}`,
      run: () =>
        sendCandidateTemplateEmail({
          templateKey: ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY,
          recipient,
          actorUserId: input.actorUserId,
          portalContext,
          variables: {
            assessmentTitle: input.assessmentTitle,
            courseName: batchContext.courseName,
            programName: batchContext.programName,
            batchName: batchContext.batchName,
            submittedAt: formatDateTime(input.submittedAt, portalContext.timeZone),
            completionNote: input.requiresManualReview
              ? "Your submission is waiting for reviewer evaluation. We will notify you again when the result is published."
              : "Your submission has been recorded successfully. Your result is also available now in the candidate portal.",
          },
          metadata: {
            batchId: input.batchId,
            batchCode: batchContext.batchCode,
            assessmentTitle: input.assessmentTitle,
          },
        }),
    },
  ]);
}

export async function sendCandidateAssessmentResultNotification(input: {
  attemptId: string;
  actorUserId?: string | null;
  reviewerNameFallback?: string | null;
}) {
  if (!isDatabaseConfigured) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  const portalContext = await getCandidatePortalContext();
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: input.attemptId },
    select: {
      id: true,
      marksObtained: true,
      totalMarks: true,
      percentage: true,
      passed: true,
      reviewerFeedback: true,
      gradedAt: true,
      learner: {
        select: {
          id: true,
          learnerCode: true,
          fullName: true,
          email: true,
          isActive: true,
        },
      },
      batch: {
        select: {
          id: true,
          code: true,
          name: true,
          program: {
            select: {
              name: true,
              course: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      assessmentPool: {
        select: {
          id: true,
          title: true,
        },
      },
      reviewedByUser: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!attempt || !attempt.learner.isActive) {
    return createNotificationDispatchSummary({ skippedCount: 1 });
  }

  const reviewerName = attempt.reviewedByUser?.name ?? fallbackText(input.reviewerNameFallback, "System auto-evaluation");

  return dispatchCandidateNotificationTasks([
    {
      label: `assessment-result:${attempt.learner.learnerCode}:${attempt.id}`,
      run: () =>
        sendCandidateTemplateEmail({
          templateKey: ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY,
          recipient: {
            learnerId: attempt.learner.id,
            learnerCode: attempt.learner.learnerCode,
            recipientName: attempt.learner.fullName,
            recipientEmail: attempt.learner.email,
          },
          actorUserId: input.actorUserId,
          portalContext,
          variables: {
            assessmentTitle: attempt.assessmentPool.title,
            courseName: attempt.batch.program.course.name,
            programName: attempt.batch.program.name,
            batchName: attempt.batch.name,
            scoreSummary: buildScoreSummary(attempt.marksObtained, attempt.totalMarks, attempt.percentage),
            resultStatus: buildResultStatus(attempt.passed),
            reviewerName,
            gradedAt: formatDateTime(attempt.gradedAt, portalContext.timeZone),
            reviewerFeedback: fallbackText(attempt.reviewerFeedback, "No additional reviewer comments were provided."),
          },
          metadata: {
            attemptId: attempt.id,
            batchId: attempt.batch.id,
            batchCode: attempt.batch.code,
            assessmentPoolId: attempt.assessmentPool.id,
          },
        }),
    },
  ]);
}