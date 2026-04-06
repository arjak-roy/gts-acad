import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { createAuthenticatedUserSession } from "@/services/auth/session-manager";
import { changeAuthenticatedPassword } from "@/services/auth";

const passwordChangeSchema = z.object({
  currentPassword: z.string().trim().min(1, "Current password is required."),
  password: z.string().trim().min(1, "New password is required."),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const body = await request.json();
    const { currentPassword, password } = passwordChangeSchema.parse(body);

    await changeAuthenticatedPassword(session.userId, currentPassword, password);

    const response = apiSuccess({ ok: true });
    const authenticatedSession = await createAuthenticatedUserSession(
      request,
      {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        requiresPasswordReset: false,
      },
      session.rememberMe === true,
    );

    response.cookies.set(authenticatedSession.cookie);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
