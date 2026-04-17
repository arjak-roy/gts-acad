import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { resolveOrCreateLiveRoom, startLiveClass, endLiveClass } from "@/services/live-class";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const eventId = body?.eventId;
    const action = body?.action;

    if (!eventId || typeof eventId !== "string") {
      throw new Error("Missing or invalid eventId.");
    }

    if (!action || !["get-token", "start", "end"].includes(action)) {
      throw new Error("Invalid action. Must be one of: get-token, start, end.");
    }

    if (action === "get-token") {
      const result = await resolveOrCreateLiveRoom(eventId, session.userId);
      return apiSuccess({
        roomId: result.roomId,
        roomCode: result.roomCode,
        authToken: result.authToken,
      });
    }

    if (action === "start") {
      const result = await startLiveClass(eventId, session.userId);
      return apiSuccess({
        roomId: result.roomId,
        authToken: result.authToken,
      });
    }

    if (action === "end") {
      await endLiveClass(eventId, session.userId);
      return apiSuccess({ ended: true });
    }

    throw new Error("Unexpected action.");
  } catch (error) {
    return apiError(error);
  }
}
