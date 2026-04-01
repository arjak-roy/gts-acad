import { apiError, apiSuccess } from "@/lib/api-response";
import { programIdSchema, updateProgramSchema } from "@/lib/validation-schemas/programs";
import { archiveProgramService, getProgramByIdService, updateProgramService } from "@/services/programs-service";

type RouteContext = {
  params: {
    programId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
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

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const input = updateProgramSchema.parse({ ...body, programId: params.programId });
    const program = await updateProgramService(input);
    return apiSuccess(program);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { programId } = programIdSchema.parse(params);
    const program = await archiveProgramService(programId);
    return apiSuccess(program);
  } catch (error) {
    return apiError(error);
  }
}
