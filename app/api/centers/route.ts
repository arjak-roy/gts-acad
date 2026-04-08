import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCenterSchema } from "@/lib/validation-schemas/centers";
import { createCenterService, listCentersService } from "@/services/centers-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "centers.view");
    const centers = await listCentersService();
    return apiSuccess(centers);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "centers.create");
    const body = await request.json();
    const input = createCenterSchema.parse(body);
    const center = await createCenterService(input, { actorUserId: session.userId });
    return apiSuccess(center, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}