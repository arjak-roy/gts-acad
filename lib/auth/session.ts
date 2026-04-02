import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import type { NextRequest } from "next/server";

export const AUTH_SESSION_COOKIE = "gts_staff_session";
export const CANDIDATE_SESSION_COOKIE = "gts_candidate_session";
export const FULL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type AuthSessionState = "pending" | "authenticated";

export type AuthSessionClaims = {
  userId: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
  state: AuthSessionState;
  challengeId?: string;
  purpose?: string;
};

export type CandidateSessionClaims = {
  learnerId: string;
  learnerCode: string;
  name: string;
  state: "authenticated";
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

function shouldUseSecureCookie(request?: NextRequest) {
  if (!request) {
    return process.env.NODE_ENV === "production";
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return request.nextUrl.protocol === "https:";
}

function buildSessionCookie(name: string, token: string, maxAgeSeconds: number, request?: NextRequest): ResponseCookie {
  return {
    name,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function buildClearedSessionCookie(name: string, request?: NextRequest): ResponseCookie {
  return buildSessionCookie(name, "", 0, request);
}

export async function createAuthSessionToken(claims: AuthSessionClaims, maxAgeSeconds: number) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSessionSecret());
}

export async function createCandidateSessionToken(claims: CandidateSessionClaims, maxAgeSeconds: number) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.learnerId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSessionSecret());
}

export async function verifyAuthSessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    return {
      userId: String(payload.userId ?? payload.sub ?? ""),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? ""),
      roles: Array.isArray(payload.roles) ? payload.roles.map((value) => String(value)) : [],
      permissions: Array.isArray(payload.permissions) ? payload.permissions.map((value) => String(value)) : [],
      state: payload.state === "pending" ? "pending" : "authenticated",
      challengeId: typeof payload.challengeId === "string" ? payload.challengeId : undefined,
      purpose: typeof payload.purpose === "string" ? payload.purpose : undefined,
    } satisfies AuthSessionClaims;
  } catch {
    return null;
  }
}

export async function verifyCandidateSessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    return {
      learnerId: String(payload.learnerId ?? payload.sub ?? ""),
      learnerCode: String(payload.learnerCode ?? ""),
      name: String(payload.name ?? ""),
      state: "authenticated",
    } satisfies CandidateSessionClaims;
  } catch {
    return null;
  }
}

export async function getAuthSession(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifyAuthSessionToken(token);
}

export async function getCandidateSession(request: NextRequest) {
  const token = request.cookies.get(CANDIDATE_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifyCandidateSessionToken(token);
}

export function buildAuthSessionCookie(request: NextRequest, token: string, maxAgeSeconds: number): ResponseCookie {
  return buildSessionCookie(AUTH_SESSION_COOKIE, token, maxAgeSeconds, request);
}

export function buildCandidateSessionCookie(request: NextRequest, token: string, maxAgeSeconds: number): ResponseCookie {
  return buildSessionCookie(CANDIDATE_SESSION_COOKIE, token, maxAgeSeconds, request);
}

export function buildActionAuthSessionCookie(token: string, maxAgeSeconds: number): ResponseCookie {
  return buildSessionCookie(AUTH_SESSION_COOKIE, token, maxAgeSeconds);
}

export function buildActionCandidateSessionCookie(token: string, maxAgeSeconds: number): ResponseCookie {
  return buildSessionCookie(CANDIDATE_SESSION_COOKIE, token, maxAgeSeconds);
}

export function buildClearedAuthSessionCookie(request: NextRequest): ResponseCookie {
  return buildClearedSessionCookie(AUTH_SESSION_COOKIE, request);
}

export function buildClearedCandidateSessionCookie(request: NextRequest): ResponseCookie {
  return buildClearedSessionCookie(CANDIDATE_SESSION_COOKIE, request);
}

export function hasPermission(claims: Pick<AuthSessionClaims, "permissions"> | null | undefined, permission: string) {
  if (!claims) {
    return false;
  }

  return claims.permissions.includes(permission);
}

export function hasRole(claims: Pick<AuthSessionClaims, "roles"> | null | undefined, roleName: string) {
  if (!claims) {
    return false;
  }

  return claims.roles.includes(roleName);
}
