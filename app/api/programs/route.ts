import { apiError, apiSuccess } from "@/lib/api-response";
import { createProgramSchema } from "@/lib/validation-schemas/programs";
import { createProgramService, listProgramsService } from "@/services/programs-service";

export async function GET() {
  try {
    const programs = await listProgramsService();
    return apiSuccess(programs);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createProgramSchema.parse(body);
    const program = await createProgramService(input);
    return apiSuccess(program, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
