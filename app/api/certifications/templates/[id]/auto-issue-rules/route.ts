import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createAutoIssueRuleSchema } from "@/lib/validation-schemas/certifications";
import {
  listAutoIssueRulesForTemplateService,
  upsertAutoIssueRuleService,
} from "@/services/certifications/auto-issue-rules";

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "certifications.view");
    const rules = await listAutoIssueRulesForTemplateService(params.id);
    return apiSuccess(rules);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "certifications.edit");
    const body = await request.json();
    const input = createAutoIssueRuleSchema.parse(body);
    const rule = await upsertAutoIssueRuleService({
      templateId: params.id,
      curriculumId: input.curriculumId ?? null,
      trigger: input.trigger,
    });
    return apiSuccess(rule, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
