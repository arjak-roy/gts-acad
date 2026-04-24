import { requirePermission } from "@/lib/auth/route-guards";
import { getTrainerPerformanceService } from "@/services/trainers-service";
import { createTrainerPerformanceGetHandler } from "@/app/api/trainers/[trainerId]/performance/handler";

export const GET = createTrainerPerformanceGetHandler({
  requirePermission,
  getTrainerPerformanceService,
});
