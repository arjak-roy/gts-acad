import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Wraps successful API payloads in a consistent JSON envelope.
 * Allows optional response init options for status and headers.
 * Keeps response shape stable across all route handlers.
 */
export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

/**
 * Normalizes thrown errors into API-safe JSON responses.
 * Expands Zod validation errors for caller-side diagnostics.
 * Falls back to generic 500 payloads for unknown runtime failures.
 */
export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    const status = resolveErrorStatus(error.message);
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}

/**
 * Translates service error messages into practical HTTP status codes.
 * Uses message heuristics to avoid leaking internal exception structure.
 * Keeps route handlers thin by centralizing status decision logic.
 */
function resolveErrorStatus(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("authentication required") || normalizedMessage.includes("unauthorized")) {
    return 401;
  }

  if (normalizedMessage.includes("forbidden")) {
    return 403;
  }

  if (normalizedMessage.includes("not found")) {
    return 404;
  }

  if (normalizedMessage.includes("missing") || normalizedMessage.includes("invalid") || normalizedMessage.includes("requires")) {
    return 400;
  }

  if (normalizedMessage.includes("only placement-ready")) {
    return 409;
  }

  if (normalizedMessage.includes("already exists") || normalizedMessage.includes("duplicate")) {
    return 409;
  }

  return 500;
}