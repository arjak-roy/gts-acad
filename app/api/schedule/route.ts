import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { createScheduleEventSchema, listScheduleEventsQuerySchema } from "@/lib/validation-schemas/schedule";
import { createScheduleEventService, listScheduleEventsService } from "@/services/schedule-service";

function assertScheduleWriteRole(role: string) {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole !== "ADMIN" && normalizedRole !== "TRAINER") {
    throw new Error("Forbidden: admin or trainer role is required.");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listScheduleEventsQuerySchema.parse({
      batchId: searchParams.get("batchId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const result = await listScheduleEventsService(query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedSession(request);
    assertScheduleWriteRole(session.role);

    const body = await request.json();
    const input = createScheduleEventSchema.parse(body);
    const result = await createScheduleEventService(input, session.userId);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
