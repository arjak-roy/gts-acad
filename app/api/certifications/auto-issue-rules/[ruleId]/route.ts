import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { toggleAutoIssueRuleSchema } from "@/lib/validation-schemas/certifications";
import {
  toggleAutoIssueRuleService,
  deleteAutoIssueRuleService,
} from "@/services/certifications/auto-issue-rules";

type RouteContext = { params: { ruleId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "certifications.edit");
    const body = await request.json();
    const input = toggleAutoIssueRuleSchema.parse(body);
    await toggleAutoIssueRuleService(params.ruleId, input.isActive);
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(_request, "certifications.delete");
    await deleteAutoIssueRuleService(params.ruleId);
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
