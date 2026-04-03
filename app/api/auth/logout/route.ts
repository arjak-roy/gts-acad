import { NextRequest, NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE, buildClearedAuthSessionCookie, buildClearedCandidateSessionCookie } from "@/lib/auth/session";
import { revokeAuthenticatedSession } from "@/services/auth-service";
import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { buildClearedAuthSessionCookie } from "@/lib/auth/session";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (sessionToken) {
    await revokeAuthenticatedSession(sessionToken);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearedAuthSessionCookie(request));
  response.cookies.set(buildClearedCandidateSessionCookie(request));
  return response;
  return withCors(request, response, ["POST", "OPTIONS"]);
}
