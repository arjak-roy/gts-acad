import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { NextRequest } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const AUTH_SESSION_COOKIE = "gts_auth_session";

export type AuthSessionState = "pending" | "authenticated";

export type AuthSessionClaims = {
  userId: string;
  email: string;
  name: string;
  role: string;
  state: AuthSessionState;
  sessionId?: string;
  rememberMe?: boolean;
  requiresPasswordReset?: boolean;
  challengeId?: string;
  purpose?: string;
  issuedAt?: number;
  expiresAt?: number;
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

function isCrossOriginBrowserRequest(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")?.trim();

  if (!requestOrigin) {
    return false;
  }

  try {
    return new URL(requestOrigin).origin !== request.nextUrl.origin;
  } catch {
    return false;
  }
}

function getAuthSessionCookiePolicy(request: NextRequest) {
  if (isCrossOriginBrowserRequest(request)) {
    // Cross-origin candidate web requests need SameSite=None or the pending
    // two-factor session cookie will not round-trip back to verification calls.
    return {
      sameSite: "none" as const,
      secure: true,
    };
  }

  return {
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(request),
  };
}

export async function createAuthSessionToken(claims: AuthSessionClaims, maxAgeSeconds: number) {
  const tokenClaims = { ...claims };
  delete tokenClaims.issuedAt;

  let builder = new SignJWT(tokenClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`);

  if (claims.sessionId) {
    builder = builder.setJti(claims.sessionId);
  }

  return builder.sign(getSessionSecret());
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
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId : typeof payload.jti === "string" ? payload.jti : undefined,
      rememberMe: payload.rememberMe === true,
      requiresPasswordReset: payload.requiresPasswordReset === true,
      challengeId: typeof payload.challengeId === "string" ? payload.challengeId : undefined,
      purpose: typeof payload.purpose === "string" ? payload.purpose : undefined,
      issuedAt: typeof payload.iat === "number" ? payload.iat : undefined,
      expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
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
  const policy = getAuthSessionCookiePolicy(request);

  return {
    name: AUTH_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: policy.sameSite,
    secure: policy.secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function buildClearedAuthSessionCookie(request: NextRequest): ResponseCookie {
  const policy = getAuthSessionCookiePolicy(request);

  return {
    name: AUTH_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: policy.sameSite,
    secure: policy.secure,
    path: "/",
    maxAge: 0,
  };
}
