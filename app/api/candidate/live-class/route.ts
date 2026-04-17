import type { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { prisma } from "@/lib/prisma-client";
import { generateCandidateJoinToken } from "@/services/live-class";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const eventId = body?.eventId;

    if (!eventId || typeof eventId !== "string") {
      throw new Error("Missing or invalid eventId.");
    }

    const profile = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });

    const result = await generateCandidateJoinToken(
      eventId,
      session.userId,
      profile?.name ?? undefined,
    );

    const response = apiSuccess({
      authToken: result.authToken,
      roomCode: result.roomCode,
      roomId: result.roomId,
    });

    return withCors(request, response, ["POST", "OPTIONS"]);
  } catch (error) {
    return apiError(error);
  }
}
