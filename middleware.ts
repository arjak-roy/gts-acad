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
  const requiresPasswordReset = isFullyAuthenticated && session?.requiresPasswordReset === true;

  if (pathname === "/reset-password") {
    if (request.nextUrl.searchParams.has("token")) {
      return appendPathnameHeader(request);
    }

    if (!isFullyAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return appendPathnameHeader(request);
  }

  if (pathname === "/login") {
    if (isFullyAuthenticated) {
      return NextResponse.redirect(new URL(requiresPasswordReset ? "/reset-password" : "/dashboard", request.url));
    }
    return appendPathnameHeader(request);
  }

  if (pathname.startsWith("/api/")) {
    return appendPathnameHeader(request);
  }

  if (!isFullyAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (requiresPasswordReset) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  return appendPathnameHeader(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};