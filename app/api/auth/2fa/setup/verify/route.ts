import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { verifyTwoFactorSetup } from "@/services/auth";

const setupVerifySchema = z.object({
  code: z.string().trim().min(6, "Verification code is required.").max(6, "Verification code must be 6 digits."),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const body = await request.json();
    const { code } = setupVerifySchema.parse(body);
    const result = await verifyTwoFactorSetup(session.userId, code);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}