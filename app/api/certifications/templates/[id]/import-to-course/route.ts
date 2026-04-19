import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { importBaseTemplateToCourseSchema } from "@/lib/validation-schemas/certifications";
import { importBaseTemplateToCourseService } from "@/services/certifications";

type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.create");
    const body = await request.json();
    const { courseId } = importBaseTemplateToCourseSchema.parse(body);
    const template = await importBaseTemplateToCourseService(params.id, courseId, {
      actorUserId: session.userId,
    });
    return apiSuccess(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
