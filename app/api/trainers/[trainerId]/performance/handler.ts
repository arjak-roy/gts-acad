import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { trainerIdSchema } from "@/lib/validation-schemas/trainers";
import type { getTrainerPerformanceService as getTrainerPerformanceServiceType } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

type RequirePermission = (request: NextRequest, permissionKey: string) => Promise<unknown>;

type RouteDependencies = {
  requirePermission: RequirePermission;
  getTrainerPerformanceService: typeof getTrainerPerformanceServiceType;
};

export function createTrainerPerformanceGetHandler(deps: RouteDependencies) {
  return async function GET(request: NextRequest, { params }: RouteContext) {
    try {
      await deps.requirePermission(request, "trainers.view");
      const { trainerId } = trainerIdSchema.parse(params);
      const performance = await deps.getTrainerPerformanceService(trainerId);
      return apiSuccess(performance);
    } catch (error) {
      return apiError(error);
    }
  };
}
