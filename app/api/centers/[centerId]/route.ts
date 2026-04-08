import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { centerIdSchema, updateCenterSchema } from "@/lib/validation-schemas/centers";
import { archiveCenterService, getCenterByIdService, updateCenterService } from "@/services/centers-service";

type RouteContext = {
  params: {
    centerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "centers.view");
    const { centerId } = centerIdSchema.parse(params);
    const center = await getCenterByIdService(centerId);

    if (!center) {
      throw new Error("Center not found.");
    }

    return apiSuccess(center);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "centers.edit");
    const body = await request.json();
    const input = updateCenterSchema.parse({ ...body, centerId: params.centerId });
    const center = await updateCenterService(input, { actorUserId: session.userId });
    return apiSuccess(center);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "centers.delete");
    const { centerId } = centerIdSchema.parse(params);
    const center = await archiveCenterService(centerId, { actorUserId: session.userId });
    return apiSuccess(center);
  } catch (error) {
    return apiError(error);
  }
}