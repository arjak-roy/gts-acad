import "server-only";

import { randomUUID } from "node:crypto";

import {
  Prisma,
  CandidateNotificationDestination,
  PushDeliveryStatus,
  PushDevicePlatform,
  PushDispatchTargetType,
  PushProvider,
} from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  CandidateNotificationsQueryInput,
  CandidatePushNotificationInput,
  CandidatePushPreferencesInput,
  DeactivatePushDeviceInput,
  RegisterPushDeviceInput,
} from "@/lib/validation-schemas/notifications";
import { AUDIT_LOG_LEVEL } from "@/services/logs-actions/constants";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { buildCandidateUserWhere, getMetadataRecord } from "@/services/users/candidate-helpers";

type CandidatePushPreferences = {
  pushNotificationsEnabled: boolean;
  batchAnnouncementsEnabled: boolean;
  assessmentAlertsEnabled: boolean;
};

type PushRecipient = {
  userId: string;
  name: string;
  email: string;
  metadata: Prisma.JsonValue;
};

type PushDeviceRecord = {
  id: string;
  userId: string;
  expoPushToken: string;
  deviceIdentifier: string | null;
  deviceName: string | null;
  platform: PushDevicePlatform;
};

type CandidateNotificationItem = {
  id: string;
  title: string;
  body: string;
  destination: CandidateNotificationDestination;
  ctaLabel: string | null;
  batchId: string | null;
  assessmentPoolId: string | null;
  isUnread: boolean;
  readAt: string | null;
  createdAt: string;
};

export type CandidateNotificationsResponse = {
  items: CandidateNotificationItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type CandidatePushReadinessSummary = {
  userId: string;
  activeDeviceCount: number;
  latestRegisteredAt: string | null;
  preferences: CandidatePushPreferences;
};

export type BatchPushReadinessSummary = {
  batchId: string;
  batchCode: string;
  batchName: string;
  candidateUserCount: number;
  pushEnabledCandidateCount: number;
  registeredCandidateCount: number;
  activeDeviceCount: number;
};

export type PushDispatchSummary = {
  dispatchId: string;
  attemptedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  failureMessages: string[];
};

const DEFAULT_PUSH_PREFERENCES: CandidatePushPreferences = {
  pushNotificationsEnabled: true,
  batchAnnouncementsEnabled: true,
  assessmentAlertsEnabled: true,
};

const MAX_FAILURE_MESSAGES = 5;
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Push notifications require database configuration.");
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function parsePushPreferences(metadataValue: Prisma.JsonValue): CandidatePushPreferences {
  const metadata = getMetadataRecord(metadataValue);
  const notificationPreferences = metadata.notificationPreferences;

  if (!notificationPreferences || typeof notificationPreferences !== "object" || Array.isArray(notificationPreferences)) {
    return DEFAULT_PUSH_PREFERENCES;
  }

  const value = notificationPreferences as Record<string, unknown>;

  return {
    pushNotificationsEnabled:
      typeof value.pushNotificationsEnabled === "boolean"
        ? value.pushNotificationsEnabled
        : DEFAULT_PUSH_PREFERENCES.pushNotificationsEnabled,
    batchAnnouncementsEnabled:
      typeof value.batchAnnouncementsEnabled === "boolean"
        ? value.batchAnnouncementsEnabled
        : DEFAULT_PUSH_PREFERENCES.batchAnnouncementsEnabled,
    assessmentAlertsEnabled:
      typeof value.assessmentAlertsEnabled === "boolean"
        ? value.assessmentAlertsEnabled
        : DEFAULT_PUSH_PREFERENCES.assessmentAlertsEnabled,
  };
}

function mergePushPreferencesMetadata(
  metadataValue: Prisma.JsonValue,
  preferences: CandidatePushPreferencesInput,
): Prisma.InputJsonValue {
  const metadata = getMetadataRecord(metadataValue);
  const currentPreferences = parsePushPreferences(metadataValue);

  return {
    ...metadata,
    notificationPreferences: {
      ...currentPreferences,
      ...preferences,
    },
  } satisfies Prisma.InputJsonObject;
}

function addFailureMessage(failureMessages: string[], message: string) {
  if (failureMessages.length >= MAX_FAILURE_MESSAGES) {
    return failureMessages;
  }

  return [...failureMessages, message];
}

function mapNotificationRow(
  row: {
    id: string;
    title: string;
    body: string;
    destination: CandidateNotificationDestination;
    ctaLabel: string | null;
    batchId: string | null;
    assessmentPoolId: string | null;
    readAt: Date | null;
    createdAt: Date;
  },
): CandidateNotificationItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    destination: row.destination,
    ctaLabel: row.ctaLabel,
    batchId: row.batchId,
    assessmentPoolId: row.assessmentPoolId,
    isUnread: row.readAt === null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizePushInput(input: CandidatePushNotificationInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    destination: input.destination as CandidateNotificationDestination,
    ctaLabel: normalizeOptionalString(input.ctaLabel),
    batchId: normalizeOptionalString(input.batchId),
    assessmentPoolId: normalizeOptionalString(input.assessmentPoolId),
  };
}

function buildPushPreferenceSummary(metadataValue: Prisma.JsonValue) {
  return parsePushPreferences(metadataValue);
}

function shouldSkipPushDelivery(
  targetType: PushDispatchTargetType,
  destination: CandidateNotificationDestination,
  preferences: CandidatePushPreferences,
) {
  if (!preferences.pushNotificationsEnabled) {
    return true;
  }

  if (targetType === PushDispatchTargetType.BATCH && !preferences.batchAnnouncementsEnabled) {
    return true;
  }

  if (destination === CandidateNotificationDestination.ASSESSMENTS && !preferences.assessmentAlertsEnabled) {
    return true;
  }

  return false;
}

async function fetchCandidateRecipient(userId: string): Promise<PushRecipient | null> {
  const record = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      ...buildCandidateUserWhere(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      metadata: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    userId: record.id,
    name: record.name,
    email: record.email,
    metadata: record.metadata,
  };
}

async function fetchBatchRecipients(batchId: string) {
  const [batch, enrollments] = await prisma.$transaction([
    prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    prisma.batchEnrollment.findMany({
      where: {
        batchId,
        status: "ACTIVE",
        learner: {
          userId: { not: null },
          isActive: true,
          user: {
            isActive: true,
          },
        },
      },
      select: {
        learner: {
          select: {
            userId: true,
            fullName: true,
            email: true,
            user: {
              select: {
                metadata: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const recipients = new Map<string, PushRecipient>();

  enrollments.forEach((enrollment) => {
    const userId = enrollment.learner.userId;

    if (!userId || recipients.has(userId)) {
      return;
    }

    recipients.set(userId, {
      userId,
      name: enrollment.learner.fullName,
      email: enrollment.learner.email,
      metadata: enrollment.learner.user?.metadata ?? {},
    });
  });

  return {
    batch,
    recipients: Array.from(recipients.values()),
  };
}

async function fetchActivePushDevices(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as PushDeviceRecord[];
  }

  return prisma.userPushDevice.findMany({
    where: {
      userId: { in: userIds },
      revokedAt: null,
      invalidatedAt: null,
      permissionsGranted: true,
    },
    select: {
      id: true,
      userId: true,
      expoPushToken: true,
      deviceIdentifier: true,
      deviceName: true,
      platform: true,
    },
  });
}

type ExpoPushSendMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: string;
  data: Record<string, string>;
};

type ExpoPushSendResult =
  | {
      status: "ok";
      id: string;
    }
  | {
      status: "error";
      message: string;
      details?: {
        error?: string;
      };
    };

async function sendExpoPushMessages(messages: ExpoPushSendMessage[]) {
  const results: ExpoPushSendResult[] = [];

  for (const chunk of chunkArray(messages, EXPO_CHUNK_SIZE)) {
    try {
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: ExpoPushSendResult[];
        errors?: Array<{ message?: string }>;
      } | null;

      if (!response.ok || !Array.isArray(payload?.data) || payload.data.length !== chunk.length) {
        const firstResult = payload?.data?.[0];
        const failureMessage =
          payload?.errors?.[0]?.message ||
          (firstResult && firstResult.status === "error" ? firstResult.message : null) ||
          `Expo push delivery failed with status ${response.status}.`;

        results.push(
          ...chunk.map(() => ({
            status: "error" as const,
            message: failureMessage,
          })),
        );
        continue;
      }

      results.push(...payload.data);
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Failed to reach Expo push service.";

      results.push(
        ...chunk.map(() => ({
          status: "error" as const,
          message: failureMessage,
        })),
      );
    }
  }

  return results;
}

type DispatchAudience = {
  targetType: PushDispatchTargetType;
  targetId: string;
  recipients: PushRecipient[];
  actorUserId?: string | null;
  input: CandidatePushNotificationInput;
};

async function createDispatchForAudience({
  targetType,
  targetId,
  recipients,
  actorUserId,
  input,
}: DispatchAudience): Promise<PushDispatchSummary> {
  const normalizedInput = normalizePushInput(input);
  const createdAt = new Date();

  const dispatch = await prisma.pushDispatch.create({
    data: {
      createdById: actorUserId ?? null,
      targetType,
      targetId,
      title: normalizedInput.title,
      body: normalizedInput.body,
      destination: normalizedInput.destination,
      ctaLabel: normalizedInput.ctaLabel,
      batchId: normalizedInput.batchId,
      assessmentPoolId: normalizedInput.assessmentPoolId,
      requestedRecipientCount: recipients.length,
      metadata: {
        source: "admin-manual-push",
        targetType,
      } satisfies Prisma.InputJsonObject,
    },
    select: { id: true },
  });

  if (recipients.length === 0) {
    return {
      dispatchId: dispatch.id,
      attemptedCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      failureMessages: [],
    };
  }

  const notifications = recipients.map((recipient) => ({
    id: randomUUID(),
    dispatchId: dispatch.id,
    userId: recipient.userId,
    title: normalizedInput.title,
    body: normalizedInput.body,
    destination: normalizedInput.destination,
    ctaLabel: normalizedInput.ctaLabel,
    batchId: normalizedInput.batchId,
    assessmentPoolId: normalizedInput.assessmentPoolId,
    metadata: {
      source: "admin-manual-push",
      recipientEmail: recipient.email,
    } satisfies Prisma.InputJsonObject,
    createdAt,
    updatedAt: createdAt,
  }));

  await prisma.candidateNotification.createMany({
    data: notifications,
  });

  const notificationByUserId = new Map(notifications.map((notification) => [notification.userId, notification]));
  const devices = await fetchActivePushDevices(recipients.map((recipient) => recipient.userId));
  const devicesByUserId = new Map<string, PushDeviceRecord[]>();

  devices.forEach((device) => {
    const currentDevices = devicesByUserId.get(device.userId) ?? [];
    currentDevices.push(device);
    devicesByUserId.set(device.userId, currentDevices);
  });

  const deliveries: Array<Prisma.CandidateNotificationDeliveryCreateManyInput> = [];
  const invalidDeviceIds = new Set<string>();
  const successfulDeviceIds = new Set<string>();
  const failureMessages: string[] = [];
  const attemptedUsers = new Map<string, { hasSuccess: boolean; hasAttempt: boolean }>();
  let skippedCount = 0;

  const pushMessages: ExpoPushSendMessage[] = [];
  const pushMessageTargets: Array<{ userId: string; device: PushDeviceRecord; notificationId: string }> = [];

  for (const recipient of recipients) {
    const preferences = buildPushPreferenceSummary(recipient.metadata);
    const recipientDevices = devicesByUserId.get(recipient.userId) ?? [];

    if (shouldSkipPushDelivery(targetType, normalizedInput.destination, preferences)) {
      skippedCount += 1;
      continue;
    }

    if (recipientDevices.length === 0) {
      skippedCount += 1;
      attemptedUsers.set(recipient.userId, { hasSuccess: false, hasAttempt: false });
      if (failureMessages.length < MAX_FAILURE_MESSAGES) {
        failureMessages.push(`No active device registered for ${recipient.name}.`);
      }
      continue;
    }

    const notification = notificationByUserId.get(recipient.userId);

    if (!notification) {
      continue;
    }

    attemptedUsers.set(recipient.userId, { hasSuccess: false, hasAttempt: true });

    recipientDevices.forEach((device) => {
      pushMessages.push({
        to: device.expoPushToken,
        title: normalizedInput.title,
        body: normalizedInput.body,
        sound: "default",
        channelId: "academy-updates",
        data: {
          notificationId: notification.id,
          destination: normalizedInput.destination,
          batchId: normalizedInput.batchId ?? "",
          assessmentPoolId: normalizedInput.assessmentPoolId ?? "",
        },
      });
      pushMessageTargets.push({
        userId: recipient.userId,
        device,
        notificationId: notification.id,
      });
    });
  }

  const pushResults = await sendExpoPushMessages(pushMessages);

  pushResults.forEach((result, index) => {
    const target = pushMessageTargets[index];

    if (!target) {
      return;
    }

    if (result.status === "ok") {
      deliveries.push({
        id: randomUUID(),
        dispatchId: dispatch.id,
        notificationId: target.notificationId,
        deviceId: target.device.id,
        provider: PushProvider.EXPO,
        status: PushDeliveryStatus.SENT,
        expoTicketId: result.id,
        expoReceiptId: null,
        errorCode: null,
        errorMessage: null,
        response: result as Prisma.InputJsonValue,
        attemptedAt: createdAt,
        updatedAt: createdAt,
      });
      successfulDeviceIds.add(target.device.id);

      const currentStatus = attemptedUsers.get(target.userId) ?? { hasSuccess: false, hasAttempt: true };
      currentStatus.hasSuccess = true;
      currentStatus.hasAttempt = true;
      attemptedUsers.set(target.userId, currentStatus);
      return;
    }

    const errorCode = result.details?.error ?? null;
    const nextStatus = errorCode === "DeviceNotRegistered" ? PushDeliveryStatus.DEVICE_INVALID : PushDeliveryStatus.FAILED;

    deliveries.push({
      id: randomUUID(),
      dispatchId: dispatch.id,
      notificationId: target.notificationId,
      deviceId: target.device.id,
      provider: PushProvider.EXPO,
      status: nextStatus,
      expoTicketId: null,
      expoReceiptId: null,
      errorCode,
      errorMessage: result.message,
      response: result as Prisma.InputJsonValue,
      attemptedAt: createdAt,
      updatedAt: createdAt,
    });

    if (nextStatus === PushDeliveryStatus.DEVICE_INVALID) {
      invalidDeviceIds.add(target.device.id);
    }

    if (failureMessages.length < MAX_FAILURE_MESSAGES) {
      failureMessages.push(`${target.device.deviceName ?? target.device.platform.toLowerCase()} delivery failed: ${result.message}`);
    }
  });

  const attemptedRecipientCount = attemptedUsers.size;
  let sentCount = 0;
  let failedCount = 0;

  attemptedUsers.forEach((status) => {
    if (!status.hasAttempt) {
      return;
    }

    if (status.hasSuccess) {
      sentCount += 1;
      return;
    }

    failedCount += 1;
  });

  const writeOperations: Prisma.PrismaPromise<unknown>[] = [
    prisma.pushDispatch.update({
      where: { id: dispatch.id },
      data: {
        sentRecipientCount: sentCount,
        failedRecipientCount: failedCount,
        skippedRecipientCount: skippedCount,
      },
    }),
  ];

  if (deliveries.length > 0) {
    writeOperations.push(prisma.candidateNotificationDelivery.createMany({ data: deliveries }));
  }

  if (successfulDeviceIds.size > 0) {
    writeOperations.push(
      prisma.userPushDevice.updateMany({
        where: { id: { in: Array.from(successfulDeviceIds) } },
        data: { lastSuccessAt: createdAt, lastSeenAt: createdAt },
      }),
    );
  }

  if (invalidDeviceIds.size > 0) {
    writeOperations.push(
      prisma.userPushDevice.updateMany({
        where: { id: { in: Array.from(invalidDeviceIds) } },
        data: {
          invalidatedAt: createdAt,
          invalidationReason: "DeviceNotRegistered",
        },
      }),
    );
  }

  await prisma.$transaction(writeOperations);

  return {
    dispatchId: dispatch.id,
    attemptedCount: attemptedRecipientCount,
    sentCount,
    failedCount,
    skippedCount,
    failureMessages,
  };
}

async function writePushAuditLog(input: {
  entityType: "CANDIDATE" | "BATCH";
  entityId: string;
  actorUserId?: string | null;
  title: string;
  summary: PushDispatchSummary;
  destination: CandidateNotificationDestination;
}) {
  await createAuditLogEntry({
    entityType: input.entityType,
    entityId: input.entityId,
    action: "UPDATED",
    level: input.summary.failedCount > 0 ? AUDIT_LOG_LEVEL.WARN : AUDIT_LOG_LEVEL.INFO,
    status: "PUSH",
    message: `Manual push dispatched: ${input.title}`,
    metadata: {
      dispatchId: input.summary.dispatchId,
      destination: input.destination,
      attemptedCount: input.summary.attemptedCount,
      sentCount: input.summary.sentCount,
      failedCount: input.summary.failedCount,
      skippedCount: input.summary.skippedCount,
      failureMessages: input.summary.failureMessages,
    } satisfies Prisma.InputJsonObject,
    actorUserId: input.actorUserId ?? null,
  });
}

export async function getCandidatePushReadinessService(userId: string): Promise<CandidatePushReadinessSummary> {
  requireDatabase();

  const [user, deviceAggregate] = await prisma.$transaction([
    prisma.user.findFirst({
      where: {
        id: userId,
        ...buildCandidateUserWhere(),
      },
      select: {
        id: true,
        metadata: true,
      },
    }),
    prisma.userPushDevice.aggregate({
      where: {
        userId,
        revokedAt: null,
        invalidatedAt: null,
        permissionsGranted: true,
      },
      _count: { _all: true },
      _max: { lastRegisteredAt: true },
    }),
  ]);

  if (!user) {
    throw new Error("Candidate user not found.");
  }

  return {
    userId: user.id,
    activeDeviceCount: deviceAggregate._count._all,
    latestRegisteredAt: deviceAggregate._max.lastRegisteredAt?.toISOString() ?? null,
    preferences: buildPushPreferenceSummary(user.metadata),
  };
}

export async function getBatchPushReadinessService(batchId: string): Promise<BatchPushReadinessSummary> {
  requireDatabase();

  const { batch, recipients } = await fetchBatchRecipients(batchId);
  const devices = await fetchActivePushDevices(recipients.map((recipient) => recipient.userId));
  const registeredUserIds = new Set(devices.map((device) => device.userId));

  return {
    batchId: batch.id,
    batchCode: batch.code,
    batchName: batch.name,
    candidateUserCount: recipients.length,
    pushEnabledCandidateCount: recipients.filter((recipient) => buildPushPreferenceSummary(recipient.metadata).pushNotificationsEnabled).length,
    registeredCandidateCount: Array.from(new Set(recipients.map((recipient) => recipient.userId))).filter((userId) => registeredUserIds.has(userId)).length,
    activeDeviceCount: devices.length,
  };
}

export async function sendCandidatePushNotificationService(
  userId: string,
  input: CandidatePushNotificationInput,
  actorUserId?: string,
) {
  requireDatabase();

  const recipient = await fetchCandidateRecipient(userId);

  if (!recipient) {
    throw new Error("Candidate user not found.");
  }

  const summary = await createDispatchForAudience({
    targetType: PushDispatchTargetType.CANDIDATE,
    targetId: userId,
    recipients: [recipient],
    actorUserId: actorUserId ?? null,
    input,
  });

  await writePushAuditLog({
    entityType: "CANDIDATE",
    entityId: userId,
    actorUserId: actorUserId ?? null,
    title: input.title,
    summary,
    destination: input.destination as CandidateNotificationDestination,
  });

  return summary;
}

export async function sendBatchPushNotificationService(
  batchId: string,
  input: CandidatePushNotificationInput,
  actorUserId?: string,
) {
  requireDatabase();

  const { recipients } = await fetchBatchRecipients(batchId);

  const summary = await createDispatchForAudience({
    targetType: PushDispatchTargetType.BATCH,
    targetId: batchId,
    recipients,
    actorUserId: actorUserId ?? null,
    input,
  });

  await writePushAuditLog({
    entityType: "BATCH",
    entityId: batchId,
    actorUserId: actorUserId ?? null,
    title: input.title,
    summary,
    destination: input.destination as CandidateNotificationDestination,
  });

  return summary;
}

export async function listCandidateNotificationsService(
  userId: string,
  input: CandidateNotificationsQueryInput,
): Promise<CandidateNotificationsResponse> {
  requireDatabase();

  const [totalCount, rows] = await prisma.$transaction([
    prisma.candidateNotification.count({ where: { userId } }),
    prisma.candidateNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        title: true,
        body: true,
        destination: true,
        ctaLabel: true,
        batchId: true,
        assessmentPoolId: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items: rows.map(mapNotificationRow),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export async function markCandidateNotificationReadService(userId: string, notificationId: string) {
  requireDatabase();

  const notification = await prisma.candidateNotification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: {
      id: true,
      readAt: true,
    },
  });

  if (!notification) {
    throw new Error("Notification not found.");
  }

  if (notification.readAt) {
    return { ok: true, readAt: notification.readAt.toISOString() };
  }

  const updated = await prisma.candidateNotification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
    select: { readAt: true },
  });

  return {
    ok: true,
    readAt: updated.readAt?.toISOString() ?? null,
  };
}

export async function getCandidatePushPreferencesService(userId: string) {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });

  if (!user) {
    throw new Error("Candidate user not found.");
  }

  return buildPushPreferenceSummary(user.metadata);
}

export async function updateCandidatePushPreferencesService(userId: string, input: CandidatePushPreferencesInput) {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });

  if (!user) {
    throw new Error("Candidate user not found.");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      metadata: mergePushPreferencesMetadata(user.metadata, input),
    },
    select: { metadata: true },
  });

  return buildPushPreferenceSummary(updated.metadata);
}

export async function registerUserPushDeviceService(userId: string, input: RegisterPushDeviceInput) {
  requireDatabase();

  const now = new Date();

  if (input.deviceId.trim().length > 0) {
    await prisma.userPushDevice.updateMany({
      where: {
        userId,
        deviceIdentifier: input.deviceId.trim(),
        expoPushToken: { not: input.expoPushToken.trim() },
      },
      data: {
        revokedAt: now,
        invalidationReason: "superseded",
      },
    });
  }

  const record = await prisma.userPushDevice.upsert({
    where: { expoPushToken: input.expoPushToken.trim() },
    update: {
      userId,
      provider: PushProvider.EXPO,
      platform: input.platform as PushDevicePlatform,
      deviceIdentifier: normalizeOptionalString(input.deviceId),
      deviceName: normalizeOptionalString(input.deviceName),
      appVersion: normalizeOptionalString(input.appVersion),
      projectId: normalizeOptionalString(input.projectId),
      permissionsGranted: input.permissionsGranted,
      lastRegisteredAt: now,
      lastSeenAt: now,
      invalidatedAt: null,
      revokedAt: null,
      invalidationReason: null,
    },
    create: {
      userId,
      provider: PushProvider.EXPO,
      platform: input.platform as PushDevicePlatform,
      deviceIdentifier: normalizeOptionalString(input.deviceId),
      expoPushToken: input.expoPushToken.trim(),
      deviceName: normalizeOptionalString(input.deviceName),
      appVersion: normalizeOptionalString(input.appVersion),
      projectId: normalizeOptionalString(input.projectId),
      permissionsGranted: input.permissionsGranted,
      lastRegisteredAt: now,
      lastSeenAt: now,
      metadata: {},
    },
    select: {
      id: true,
      expoPushToken: true,
      deviceIdentifier: true,
      platform: true,
      lastRegisteredAt: true,
    },
  });

  return {
    ok: true,
    deviceId: record.id,
    expoPushToken: record.expoPushToken,
    deviceIdentifier: record.deviceIdentifier,
    platform: record.platform,
    lastRegisteredAt: record.lastRegisteredAt.toISOString(),
  };
}

export async function deactivateUserPushDeviceService(userId: string, input: DeactivatePushDeviceInput) {
  requireDatabase();

  const now = new Date();
  const result = await prisma.userPushDevice.updateMany({
    where: {
      userId,
      OR: [
        ...(input.deviceId.trim().length > 0 ? [{ deviceIdentifier: input.deviceId.trim() }] : []),
        ...(input.expoPushToken.trim().length > 0 ? [{ expoPushToken: input.expoPushToken.trim() }] : []),
      ],
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      invalidationReason: "user-sign-out",
    },
  });

  return {
    ok: true,
    deactivatedCount: result.count,
  };
}