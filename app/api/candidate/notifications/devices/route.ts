import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { deactivatePushDeviceSchema, registerPushDeviceSchema } from "@/lib/validation-schemas/notifications";
import { deactivateUserPushDeviceService, registerUserPushDeviceService } from "@/services/push-notifications";

const METHODS = ["POST", "DELETE", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = registerPushDeviceSchema.parse(body);
    const result = await registerUserPushDeviceService(session.userId, input);
    return withCors(request, apiSuccess(result), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = deactivatePushDeviceSchema.parse(body);
    const result = await deactivateUserPushDeviceService(session.userId, input);
    return withCors(request, apiSuccess(result), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}