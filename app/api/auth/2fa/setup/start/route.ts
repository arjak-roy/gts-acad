import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { getAuthSession } from "@/lib/auth/session";
import { startTwoFactorSetup } from "@/services/auth-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session || session.state !== "authenticated") {
      throw new Error("Two-factor setup requires an authenticated session.");
    }

    const result = await startTwoFactorSetup(session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}