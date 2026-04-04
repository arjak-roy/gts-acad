import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { buildAuthSessionCookie, createAuthSessionToken, FULL_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { changeAuthenticatedPassword } from "@/services/auth-service";

const passwordChangeSchema = z.object({
  currentPassword: z.string().trim().min(1, "Current password is required."),
  password: z.string().trim().min(8, "Password must be at least 8 characters long."),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const body = await request.json();
    const { currentPassword, password } = passwordChangeSchema.parse(body);

    await changeAuthenticatedPassword(session.userId, currentPassword, password);

    const response = apiSuccess({ ok: true });
    const token = await createAuthSessionToken(
      {
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        requiresPasswordReset: false,
        state: "authenticated",
      },
      FULL_SESSION_MAX_AGE_SECONDS,
    );

    response.cookies.set(buildAuthSessionCookie(request, token, FULL_SESSION_MAX_AGE_SECONDS));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
