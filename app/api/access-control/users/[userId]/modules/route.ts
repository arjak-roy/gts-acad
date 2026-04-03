import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestSuperAdminSession } from "@/lib/auth/access";
import { assignModulesSchema } from "@/lib/validation-schemas/access-control";
import { assignUserModulePermissions } from "@/services/access-control-service";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireRequestSuperAdminSession(request);
    const body = await request.json();
    const parsed = assignModulesSchema.parse(body);
    const updatedUser = await assignUserModulePermissions(params.userId, parsed.modules);
    return apiSuccess(updatedUser);
  } catch (error) {
    return apiError(error);
  }
}