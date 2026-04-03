import { NextRequest, NextResponse } from "next/server";

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function getConfiguredOrigins() {
  return [process.env.CANDIDATE_APP_ORIGIN, process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));
}

function resolveAllowedOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")?.trim();

  if (!requestOrigin) {
    return null;
  }

  if (getConfiguredOrigins().includes(requestOrigin)) {
    return requestOrigin;
  }

  if (localhostOriginPattern.test(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

export function withCors(request: NextRequest, response: NextResponse, methods: string[]) {
  const allowedOrigin = resolveAllowedOrigin(request);

  if (!allowedOrigin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", methods.join(", "));
  response.headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("access-control-request-headers") ?? "Content-Type, X-GTS-Client",
  );
  response.headers.set("Vary", "Origin");

  return response;
}

export function handleCorsPreflight(request: NextRequest, methods: string[]) {
  return withCors(request, new NextResponse(null, { status: 204 }), methods);
}