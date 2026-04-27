import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  TRAINER_SESSION_NOTIFICATION_EMAIL_TEMPLATE_KEY,
} from "@/lib/mail-templates/email-template-keys";
import { renderEmailTemplateByKeyService } from "@/services/email-templates/render";
import { deliverLoggedEmail } from "@/services/logs-actions/email-log-service";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";

// ── Types ──────────────────────────────────────────────────────

type TrainerNotificationRecipient = {
  trainerProfileId: string;
  userId: string;
  name: string;
  email: string;
};

type SessionNotificationContext = {
  eventId: string;
  eventTitle: string;
  courseName: string | null;
  batchName: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  meetingUrl: string | null;
};

type NotificationResult = {
  sentCount: number;
  failedCount: number;
};

// ── Helpers ────────────────────────────────────────────────────

async function getAppContext() {
  try {
    const settings = await getGeneralRuntimeSettings();
    return {
      appName: settings.applicationName ?? "GTS Academy",
      supportEmail: settings.supportEmail ?? "",
      portalUrl: settings.applicationUrl ?? "",
    };
  } catch {
    return { appName: "GTS Academy", supportEmail: "", portalUrl: "" };
  }
}

async function resolveEventTrainerRecipients(eventId: string): Promise<TrainerNotificationRecipient[]> {
  const assignments = await prisma.trainerSessionAssignment.findMany({
    where: { scheduleEventId: eventId, removedAt: null },
    select: {
      trainerProfileId: true,
      trainerProfile: {
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return assignments.map((a) => ({
    trainerProfileId: a.trainerProfileId,
    userId: a.trainerProfile.userId,
    name: a.trainerProfile.user.name,
    email: a.trainerProfile.user.email,
  }));
}

async function resolveEventContext(eventId: string): Promise<SessionNotificationContext | null> {
  const event = await prisma.batchScheduleEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      meetingUrl: true,
      batch: {
        select: {
          name: true,
          program: {
            select: {
              course: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!event) return null;

  return {
    eventId: event.id,
    eventTitle: event.title,
    courseName: event.batch.program?.course?.name ?? null,
    batchName: event.batch.name,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    meetingUrl: event.meetingUrl,
  };
}

function formatDateTime(date: Date | null | undefined, timeZone?: string): string {
  if (!date) return "Not specified";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || "UTC",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

async function sendTrainerSessionEmail(
  recipient: TrainerNotificationRecipient,
  context: SessionNotificationContext,
  action: string,
  extraVars: Record<string, string | null> = {},
  actorUserId: string | null,
) {
  const appCtx = await getAppContext();

  const template = await renderEmailTemplateByKeyService(
    TRAINER_SESSION_NOTIFICATION_EMAIL_TEMPLATE_KEY,
    {
      appName: appCtx.appName,
      recipientName: recipient.name,
      portalUrl: appCtx.portalUrl,
      supportEmail: appCtx.supportEmail,
      action,
      sessionTitle: context.eventTitle,
      courseName: context.courseName ?? "N/A",
      batchName: context.batchName,
      startsAt: formatDateTime(context.startsAt),
      endsAt: formatDateTime(context.endsAt),
      location: context.location ?? "Not specified",
      meetingUrl: context.meetingUrl ?? "Not provided",
      ...extraVars,
    },
  );

  await deliverLoggedEmail({
    to: recipient.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: TRAINER_SESSION_NOTIFICATION_EMAIL_TEMPLATE_KEY,
    metadata: {
      trainerProfileId: recipient.trainerProfileId,
      eventId: context.eventId,
      action,
    },
    audit: {
      entityType: "SYSTEM" as any,
      entityId: recipient.trainerProfileId,
      actorUserId,
    },
  });
}

// ── Public API ─────────────────────────────────────────────────

export async function notifyTrainersOfSessionCreated(
  eventId: string,
  actorUserId: string | null,
): Promise<NotificationResult> {
  if (!isDatabaseConfigured) return { sentCount: 0, failedCount: 0 };

  const [recipients, context] = await Promise.all([
    resolveEventTrainerRecipients(eventId),
    resolveEventContext(eventId),
  ]);

  if (!context || recipients.length === 0) return { sentCount: 0, failedCount: 0 };

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      await sendTrainerSessionEmail(recipient, context, "Session Scheduled", {}, actorUserId);
      sentCount++;
    } catch (error) {
      console.warn(`Failed to notify trainer ${recipient.email} of session creation:`, error);
      failedCount++;
    }
  }

  return { sentCount, failedCount };
}

export async function notifyTrainersOfSessionRescheduled(
  eventId: string,
  reason: string | null,
  actorUserId: string | null,
): Promise<NotificationResult> {
  if (!isDatabaseConfigured) return { sentCount: 0, failedCount: 0 };

  const [recipients, context] = await Promise.all([
    resolveEventTrainerRecipients(eventId),
    resolveEventContext(eventId),
  ]);

  if (!context || recipients.length === 0) return { sentCount: 0, failedCount: 0 };

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      await sendTrainerSessionEmail(
        recipient,
        context,
        "Session Rescheduled",
        { rescheduleReason: reason ?? "No reason provided" },
        actorUserId,
      );
      sentCount++;
    } catch (error) {
      console.warn(`Failed to notify trainer ${recipient.email} of reschedule:`, error);
      failedCount++;
    }
  }

  return { sentCount, failedCount };
}

export async function notifyTrainersOfSessionCancelled(
  eventId: string,
  reason: string | null,
  actorUserId: string | null,
): Promise<NotificationResult> {
  if (!isDatabaseConfigured) return { sentCount: 0, failedCount: 0 };

  const [recipients, context] = await Promise.all([
    resolveEventTrainerRecipients(eventId),
    resolveEventContext(eventId),
  ]);

  if (!context || recipients.length === 0) return { sentCount: 0, failedCount: 0 };

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      await sendTrainerSessionEmail(
        recipient,
        context,
        "Session Cancelled",
        { cancellationReason: reason ?? "No reason provided" },
        actorUserId,
      );
      sentCount++;
    } catch (error) {
      console.warn(`Failed to notify trainer ${recipient.email} of cancellation:`, error);
      failedCount++;
    }
  }

  return { sentCount, failedCount };
}

export async function notifyTrainerOfAssignment(
  eventId: string,
  trainerProfileId: string,
  actorUserId: string | null,
): Promise<NotificationResult> {
  if (!isDatabaseConfigured) return { sentCount: 0, failedCount: 0 };

  const context = await resolveEventContext(eventId);
  if (!context) return { sentCount: 0, failedCount: 0 };

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerProfileId },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!trainer) return { sentCount: 0, failedCount: 0 };

  try {
    await sendTrainerSessionEmail(
      {
        trainerProfileId: trainer.id,
        userId: trainer.userId,
        name: trainer.user.name,
        email: trainer.user.email,
      },
      context,
      "You Have Been Assigned to a Session",
      {},
      actorUserId,
    );
    return { sentCount: 1, failedCount: 0 };
  } catch (error) {
    console.warn(`Failed to notify trainer ${trainer.user.email} of assignment:`, error);
    return { sentCount: 0, failedCount: 1 };
  }
}
