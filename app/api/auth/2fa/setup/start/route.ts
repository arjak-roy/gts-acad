import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { startTwoFactorSetup } from "@/services/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const result = await startTwoFactorSetup(session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}