import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getProgramByIdService } from "@/services/programs-service";
import { getTrainersForProgramService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    programId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "programs.view");
    const program = await getProgramByIdService(params.programId);
    if (!program) {
      throw new Error("Program not found.");
    }

    const trainers = await getTrainersForProgramService(program.name);
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}
