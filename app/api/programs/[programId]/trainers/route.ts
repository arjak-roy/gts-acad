import { apiError, apiSuccess } from "@/lib/api-response";
import { getProgramByIdService } from "@/services/programs-service";
import { getTrainersForProgramService } from "@/services/trainers-service";

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

    // Get trainers for this program
    const trainers = await getTrainersForProgramService(program.name);
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}
