import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MOCK_AUTH_COOKIE = "gts_mock_session";

function appendPathnameHeader(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(MOCK_AUTH_COOKIE)?.value;
  const isLoggedIn = Boolean(session);

  if (pathname === "/login") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return appendPathnameHeader(request);
  }

  if (pathname.startsWith("/api/")) {
    return appendPathnameHeader(request);
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return appendPathnameHeader(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};