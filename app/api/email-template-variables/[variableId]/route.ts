import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { deleteEmailTemplateVariableService } from "@/services/email-templates/variables";

type RouteContext = {
  params: {
    variableId: string;
  };
};

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "email_templates.delete");
    const { variableId } = params;

    if (!variableId) {
      throw new Error("Variable ID is required.");
    }

    await deleteEmailTemplateVariableService(variableId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
