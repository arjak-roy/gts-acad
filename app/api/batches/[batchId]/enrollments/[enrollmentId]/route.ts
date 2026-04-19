import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateEnrollmentStatusService } from "@/services/batches/commands";

const updateEnrollmentStatusSchema = z.object({
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "DROPPED"]),
});

type RouteContext = {
  params: {
    batchId: string;
    enrollmentId: string;
  };
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "batches.edit");

    const enrollmentId = z.string().uuid().parse(params.enrollmentId);
    const body = await request.json();
    const { status } = updateEnrollmentStatusSchema.parse(body);

    const result = await updateEnrollmentStatusService(enrollmentId, status, {
      actorUserId: session.userId,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
