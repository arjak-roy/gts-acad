import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCurriculumFromTemplateSchema, saveCurriculumAsTemplateSchema } from "@/lib/validation-schemas/curriculum";
import { createCurriculumFromTemplateService, listCurriculumTemplatesService, saveCurriculumAsTemplateService } from "@/services/curriculum-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "curriculum.view");
    const templates = await listCurriculumTemplatesService();
    return apiSuccess(templates);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.create");
    const body = await request.json();

    const action = String(body?.action ?? "").trim();

    if (action === "save-as-template") {
      const input = saveCurriculumAsTemplateSchema.parse(body);
      const template = await saveCurriculumAsTemplateService(input, { actorUserId: session.userId });
      return apiSuccess(template, { status: 201 });
    }

    if (action === "create-from-template") {
      const input = createCurriculumFromTemplateSchema.parse(body);
      const curriculum = await createCurriculumFromTemplateService(input, { actorUserId: session.userId });
      return apiSuccess(curriculum, { status: 201 });
    }

    return apiError(new Error("Invalid action. Use 'save-as-template' or 'create-from-template'."));
  } catch (error) {
    return apiError(error);
  }
}
