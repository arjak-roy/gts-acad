import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import {
  tablePreferenceParamsSchema,
  updateTablePreferenceSchema,
} from "@/lib/validation-schemas/table-preferences";
import {
  getUserTablePreferenceService,
  updateUserTablePreferenceService,
} from "@/services/table-preferences";

type RouteContext = {
  params: {
    tableKey: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuthenticatedSession(request);
    const { tableKey } = tablePreferenceParamsSchema.parse(params);
    const preferences = await getUserTablePreferenceService(session.userId, tableKey);
    return apiSuccess({ tableKey, preferences });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuthenticatedSession(request);
    const { tableKey } = tablePreferenceParamsSchema.parse(params);
    const body = await request.json();
    const input = updateTablePreferenceSchema.parse(body);
    const preferences = await updateUserTablePreferenceService(session.userId, tableKey, input);
    return apiSuccess({ tableKey, preferences });
  } catch (error) {
    return apiError(error);
  }
}