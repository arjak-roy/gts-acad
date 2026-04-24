import { requirePermission } from "@/lib/auth/route-guards";
import { listTrainerActivityService } from "@/services/trainers-service";
import { createTrainerActivityGetHandler } from "@/app/api/trainers/[trainerId]/activity/handler";

export const GET = createTrainerActivityGetHandler({
  requirePermission,
  listTrainerActivityService,
});
