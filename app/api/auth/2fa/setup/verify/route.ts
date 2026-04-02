import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { getAuthSession } from "@/lib/auth/session";
import { verifyTwoFactorSetup } from "@/services/auth-service";

const setupVerifySchema = z.object({
  code: z.string().trim().min(6, "Verification code is required.").max(6, "Verification code must be 6 digits."),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session || session.state !== "authenticated") {
      throw new Error("Two-factor setup requires an authenticated session.");
    }

    const body = await request.json();
    const { code } = setupVerifySchema.parse(body);
    const result = await verifyTwoFactorSetup(session.userId, code);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}