import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { NextRequest } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const AUTH_SESSION_COOKIE = "gts_auth_session";
export const FULL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type AuthSessionState = "pending" | "authenticated";

export type AuthSessionClaims = {
  userId: string;
  email: string;
  name: string;
  role: string;
  state: AuthSessionState;
  requiresPasswordReset?: boolean;
  challengeId?: string;
  purpose?: string;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

function shouldUseSecureCookie(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return request.nextUrl.protocol === "https:";
}

export async function createAuthSessionToken(claims: AuthSessionClaims, maxAgeSeconds: number) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
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
      state: payload.state === "pending" ? "pending" : "authenticated",
      requiresPasswordReset: payload.requiresPasswordReset === true,
      challengeId: typeof payload.challengeId === "string" ? payload.challengeId : undefined,
      purpose: typeof payload.purpose === "string" ? payload.purpose : undefined,
    } satisfies AuthSessionClaims;
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

export function buildAuthSessionCookie(request: NextRequest, token: string, maxAgeSeconds: number): ResponseCookie {
  return {
    name: AUTH_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function buildClearedAuthSessionCookie(request: NextRequest): ResponseCookie {
  return {
    name: AUTH_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 0,
  };
}
