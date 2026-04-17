import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { PUSH_NOTIFICATIONS_PERMISSIONS } from "@/lib/notifications/constants";
import { candidatePushNotificationSchema } from "@/lib/validation-schemas/notifications";
import { userIdSchema } from "@/lib/validation-schemas/users";
import {
  getCandidatePushReadinessService,
  sendCandidatePushNotificationService,
} from "@/services/push-notifications";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, PUSH_NOTIFICATIONS_PERMISSIONS.view);
    const { userId } = userIdSchema.parse(params);
    const summary = await getCandidatePushReadinessService(userId);
    return apiSuccess(summary);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, PUSH_NOTIFICATIONS_PERMISSIONS.send);
    const { userId } = userIdSchema.parse(params);
    const body = await request.json();
    const input = candidatePushNotificationSchema.parse(body);
    const result = await sendCandidatePushNotificationService(userId, input, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}