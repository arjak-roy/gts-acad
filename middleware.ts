import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthSession, getCandidateSession } from "@/lib/auth/session";
import { canAccessModule, getDefaultPortalPath, isSuperAdminSession, resolveModuleForPathname } from "@/lib/auth/module-access";

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
  const [staffSession, candidateSession] = await Promise.all([getAuthSession(request), getCandidateSession(request)]);
  const isStaffAuthenticated = staffSession?.state === "authenticated";
  const isCandidateAuthenticated = candidateSession?.state === "authenticated";
  const isLearnerRoute = pathname === "/learners" || pathname.startsWith("/learners/");
  const isSuperAdminRoute = pathname === "/super-admin" || pathname.startsWith("/super-admin/");
  const moduleKey = resolveModuleForPathname(pathname);

  if (pathname === "/login") {
    if (isStaffAuthenticated) {
      return NextResponse.redirect(new URL(getDefaultPortalPath(staffSession), request.url));
    }

    if (isCandidateAuthenticated) {
      return NextResponse.redirect(new URL("/learners", request.url));
    }

    return appendPathnameHeader(request);
  }

  if (pathname === "/learners/login") {
    if (isCandidateAuthenticated) {
      return NextResponse.redirect(new URL("/learners", request.url));
    }

    if (isStaffAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return appendPathnameHeader(request);
  }

  if (pathname.startsWith("/api/")) {
    return appendPathnameHeader(request);
  }

  if (pathname === "/access-denied") {
    if (isCandidateAuthenticated) {
      return NextResponse.redirect(new URL("/learners", request.url));
    }

    if (!isStaffAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return appendPathnameHeader(request);
  }

  if (isLearnerRoute) {
    if (isStaffAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isCandidateAuthenticated) {
      return NextResponse.redirect(new URL("/learners/login", request.url));
    }

    return appendPathnameHeader(request);
  }

  if (isCandidateAuthenticated) {
    return NextResponse.redirect(new URL("/learners", request.url));
  }

  if (!isStaffAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isSuperAdminRoute) {
    const canAccessSuperAdmin = isSuperAdminSession(staffSession) || staffSession.permissions.includes("roles:manage");

    if (!canAccessSuperAdmin) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }

    return appendPathnameHeader(request);
  }

  if (moduleKey && !canAccessModule(staffSession, moduleKey)) {
      const fallbackPath = getDefaultPortalPath(staffSession);
      const targetPath = fallbackPath === pathname ? "/access-denied" : fallbackPath;
      return NextResponse.redirect(new URL(targetPath, request.url));
  }

  return appendPathnameHeader(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};