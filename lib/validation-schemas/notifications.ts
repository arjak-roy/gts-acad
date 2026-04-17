import { z } from "zod";

const destinationValues = [
  "DASHBOARD",
  "PROGRAM_DETAIL",
  "ASSESSMENTS",
  "SUPPORT",
  "NOTIFICATION_CENTER",
] as const;

const platformValues = ["ANDROID", "IOS", "WEB", "UNKNOWN"] as const;

export const candidateNotificationDestinationSchema = z.enum(destinationValues);

export const candidatePushNotificationSchema = z
  .object({
    title: z.string().trim().min(2, "Title is required.").max(255),
    body: z.string().trim().min(4, "Message is required.").max(2000),
    destination: candidateNotificationDestinationSchema.default("NOTIFICATION_CENTER"),
    ctaLabel: z.string().trim().max(120).optional().default(""),
    batchId: z.string().trim().max(120).optional().default(""),
    assessmentPoolId: z.string().trim().max(120).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.destination === "PROGRAM_DETAIL" && value.batchId.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchId"],
        message: "A batch is required when opening program detail.",
      });
    }

    if (value.assessmentPoolId.trim().length > 0 && value.batchId.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchId"],
        message: "A batch is required when linking to a specific assessment.",
      });
    }
  });

export const candidateNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const candidateNotificationIdSchema = z.object({
  notificationId: z.string().trim().min(1).max(120),
});

export const candidatePushPreferencesSchema = z.object({
  pushNotificationsEnabled: z.boolean(),
  batchAnnouncementsEnabled: z.boolean(),
  assessmentAlertsEnabled: z.boolean(),
});

export const registerPushDeviceSchema = z.object({
  deviceId: z.string().trim().min(8).max(120),
  expoPushToken: z.string().trim().min(8).max(255),
  platform: z.enum(platformValues),
  deviceName: z.string().trim().max(120).optional().default(""),
  appVersion: z.string().trim().max(50).optional().default(""),
  projectId: z.string().trim().max(120).optional().default(""),
  permissionsGranted: z.boolean().default(true),
});

export const deactivatePushDeviceSchema = z
  .object({
    deviceId: z.string().trim().max(120).optional().default(""),
    expoPushToken: z.string().trim().max(255).optional().default(""),
  })
  .refine(
    (value) => value.deviceId.trim().length > 0 || value.expoPushToken.trim().length > 0,
    { message: "A device id or Expo push token is required." },
  );

export type CandidatePushNotificationInput = z.infer<typeof candidatePushNotificationSchema>;
export type CandidateNotificationsQueryInput = z.infer<typeof candidateNotificationsQuerySchema>;
export type CandidatePushPreferencesInput = z.infer<typeof candidatePushPreferencesSchema>;
export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;
export type DeactivatePushDeviceInput = z.infer<typeof deactivatePushDeviceSchema>;