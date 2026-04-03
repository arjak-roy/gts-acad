import { NextRequest } from "next/server";
import { z } from "zod";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getClientIpAddress } from "@/lib/auth/login-rate-limiter";
import { requestPasswordReset } from "@/services/auth-service";

const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("Valid email is required."),
});

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = requestPasswordResetSchema.parse(body);

    await requestPasswordReset(email, {
      requestIp: getClientIpAddress(request),
      userAgent: request.headers.get("user-agent"),
    });

    return withCors(
      request,
      apiSuccess({
        ok: true,
        message: "If an account exists for this email, password reset instructions have been sent.",
      }),
      ["POST", "OPTIONS"],
    );
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "OPTIONS"]);
  }
}
