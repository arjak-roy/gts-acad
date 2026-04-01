import { apiError, apiSuccess } from "@/lib/api-response";
import { getProgramByIdService } from "@/services/programs-service";
import { getBatchesForProgramService } from "@/services/batches-service";

type RouteContext = {
  params: {
    programId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    // First verify the program exists
    const program = await getProgramByIdService(params.programId);
    if (!program) {
      throw new Error("Program not found.");
    }

    // Get batches for this program
    const batches = await getBatchesForProgramService(program.name);
    return apiSuccess(batches);
  } catch (error) {
    return apiError(error);
  }
}
