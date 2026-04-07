import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { changeAuthenticatedPassword } from "@/services/auth";

const METHODS = ["POST", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    const body = await request.json();
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;

    if (!currentPassword || typeof currentPassword !== "string") {
      throw new Error("Current password is required.");
    }

    if (!newPassword || typeof newPassword !== "string") {
      throw new Error("New password is required.");
    }

    await changeAuthenticatedPassword(session.userId, currentPassword, newPassword);

    const response = apiSuccess({ ok: true });
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}
