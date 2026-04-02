import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { createProgramSchema } from "@/lib/validation-schemas/programs";
import { createProgramService, listProgramsService } from "@/services/programs-service";

export async function GET(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "programs");
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId") ?? undefined;
    const programs = await listProgramsService(courseId);
    return apiSuccess(programs);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "programs");
    const body = await request.json();
    const input = createProgramSchema.parse(body);
    const program = await createProgramService(input);
    return apiSuccess(program, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
