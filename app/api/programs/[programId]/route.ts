import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { programIdSchema, updateProgramSchema } from "@/lib/validation-schemas/programs";
import { archiveProgramService, getProgramByIdService, updateProgramService } from "@/services/programs-service";

type RouteContext = {
  params: {
    programId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "programs.view");
    const { programId } = programIdSchema.parse(params);
    const program = await getProgramByIdService(programId);

    if (!program) {
      throw new Error("Program not found.");
    }

    return apiSuccess(program);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "programs.edit");
    const body = await request.json();
    const input = updateProgramSchema.parse({ ...body, programId: params.programId });
    const program = await updateProgramService(input, session.userId);
    return apiSuccess(program);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "programs.delete");
    const { programId } = programIdSchema.parse(params);
    const program = await archiveProgramService(programId, session.userId);
    return apiSuccess(program);
  } catch (error) {
    return apiError(error);
  }
}
