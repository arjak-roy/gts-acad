import type { NextRequest } from "next/server";
import { z } from "zod";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { changeAuthenticatedPassword } from "@/services/auth";
import { createAuthenticatedUserSession } from "@/services/auth/session-manager";

const METHODS = ["POST", "OPTIONS"];
const passwordChangeSchema = z.object({
  currentPassword: z.string().trim().min(1, "Current password is required."),
  newPassword: z.string().trim().min(1, "New password is required."),
});

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const body = await request.json();
    const { currentPassword, newPassword } = passwordChangeSchema.parse(body);

    await changeAuthenticatedPassword(session.userId, currentPassword, newPassword);

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

    const response = apiSuccess({
      ok: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      },
      session: {
        rememberMe: session.rememberMe === true,
        requiresPasswordReset: false,
        expiresAt: authenticatedSession.expiresAt.toISOString(),
      },
    });

    response.cookies.set(authenticatedSession.cookie);
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}
