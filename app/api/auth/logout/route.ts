import { NextRequest, NextResponse } from "next/server";

import { buildClearedAuthSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearedAuthSessionCookie(request));
  return response;
}
