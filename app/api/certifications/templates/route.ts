import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCertificateTemplateSchema } from "@/lib/validation-schemas/certifications";
import {
  listAllCertificateTemplatesService,
  listCertificateTemplatesByCourseService,
  listBaseTemplatesService,
  createCertificateTemplateService,
} from "@/services/certifications";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "certifications.view");

    const courseId = request.nextUrl.searchParams.get("courseId");
    const base = request.nextUrl.searchParams.get("base");

    const templates = base === "true"
      ? await listBaseTemplatesService()
      : courseId
        ? await listCertificateTemplatesByCourseService(courseId)
        : await listAllCertificateTemplatesService();

    return apiSuccess(templates);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "certifications.create");
    const body = await request.json();
    const input = createCertificateTemplateSchema.parse(body);
    const template = await createCertificateTemplateService(input, { actorUserId: session.userId });
    return apiSuccess(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
