import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { commitTrainerImportSchema } from "@/lib/validation-schemas/trainers";
import { commitTrainerImportService } from "@/services/trainers-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "trainers.create");
    const body = await request.json();
    const input = commitTrainerImportSchema.parse(body);
    const result = await commitTrainerImportService(input, { actorUserId: session.userId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}