import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { PUSH_NOTIFICATIONS_PERMISSIONS } from "@/lib/notifications/constants";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import { candidatePushNotificationSchema } from "@/lib/validation-schemas/notifications";
import { getBatchPushReadinessService, sendBatchPushNotificationService } from "@/services/push-notifications";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, PUSH_NOTIFICATIONS_PERMISSIONS.view);
    const { batchId } = batchIdSchema.parse(params);
    const summary = await getBatchPushReadinessService(batchId);
    return apiSuccess(summary);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, PUSH_NOTIFICATIONS_PERMISSIONS.send);
    const { batchId } = batchIdSchema.parse(params);
    const body = await request.json();
    const input = candidatePushNotificationSchema.parse(body);
    const result = await sendBatchPushNotificationService(batchId, input, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}