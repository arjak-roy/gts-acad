import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { promoteTemplateToBaseService } from "@/services/certifications";

type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.edit");
    const base = await promoteTemplateToBaseService(params.id, { actorUserId: session.userId });
    return apiSuccess(base, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
