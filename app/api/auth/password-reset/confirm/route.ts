import { NextRequest } from "next/server";
import { z } from "zod";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { resetPasswordWithToken } from "@/services/auth-service";

const confirmPasswordResetSchema = z.object({
  token: z.string().trim().min(1, "Password reset token is required."),
  password: z.string().trim().min(1, "Password is required."),
});

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = confirmPasswordResetSchema.parse(body);

    await resetPasswordWithToken(token, password);

    return withCors(request, apiSuccess({ ok: true }), ["POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "OPTIONS"]);
  }
}
