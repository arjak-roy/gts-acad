import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { revokeCertificateSchema } from "@/lib/validation-schemas/certifications";
import { revokeCertificateService } from "@/services/certifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(request, "certifications.revoke");
    const { id } = await context.params;
    const body = await request.json();
    const input = revokeCertificateSchema.parse(body);
    const result = await revokeCertificateService(id, input, { actorUserId: session.userId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
