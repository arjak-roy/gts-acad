import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestSuperAdminSession } from "@/lib/auth/access";
import { listManagedAccessUsers } from "@/services/access-control-service";

export async function GET(request: NextRequest) {
  try {
    await requireRequestSuperAdminSession(request);
    return apiSuccess(await listManagedAccessUsers());
  } catch (error) {
    return apiError(error);
  }
}