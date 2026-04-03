import { NextRequest, NextResponse } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { buildClearedAuthSessionCookie } from "@/lib/auth/session";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearedAuthSessionCookie(request));
  return withCors(request, response, ["POST", "OPTIONS"]);
}
