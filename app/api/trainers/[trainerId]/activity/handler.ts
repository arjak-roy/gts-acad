import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { trainerIdSchema } from "@/lib/validation-schemas/trainers";
import type { listTrainerActivityService as listTrainerActivityServiceType } from "@/services/trainers-service";

const listTrainerActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

type RouteContext = {
  params: {
    trainerId: string;
  };
};

type RequirePermission = (request: NextRequest, permissionKey: string) => Promise<unknown>;

type RouteDependencies = {
  requirePermission: RequirePermission;
  listTrainerActivityService: typeof listTrainerActivityServiceType;
};

export function createTrainerActivityGetHandler(deps: RouteDependencies) {
  return async function GET(request: NextRequest, { params }: RouteContext) {
    try {
      await deps.requirePermission(request, "trainers.view");
      const { trainerId } = trainerIdSchema.parse(params);
      const query = listTrainerActivityQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
      const activity = await deps.listTrainerActivityService({
        trainerId,
        page: query.page,
        pageSize: query.pageSize,
      });
      return apiSuccess(activity);
    } catch (error) {
      return apiError(error);
    }
  };
}
