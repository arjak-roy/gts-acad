import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";

function appendPathnameHeader(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getAuthSession(request);
  const isFullyAuthenticated = session?.state === "authenticated";

  if (pathname === "/login") {
    if (isFullyAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return appendPathnameHeader(request);
  }

  if (pathname.startsWith("/api/")) {
    return appendPathnameHeader(request);
  }

  if (!isFullyAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return appendPathnameHeader(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};