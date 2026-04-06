import { NextRequest, NextResponse } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { buildClearedAuthSessionCookie, getAuthSession } from "@/lib/auth/session";
import { revokeUserSession } from "@/services/auth/session-manager";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession(request);

  if (session?.state === "authenticated" && session.sessionId) {
    await revokeUserSession(session.userId, session.sessionId, "logout");
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearedAuthSessionCookie(request));
  return withCors(request, response, ["POST", "OPTIONS"]);
}
