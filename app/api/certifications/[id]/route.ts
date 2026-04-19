import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getCertificateByIdService } from "@/services/certifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(request, "certifications.view");
    const { id } = await context.params;
    const certificate = await getCertificateByIdService(id);

    if (!certificate) {
      return apiError(new Error("Certificate not found."));
    }

    return apiSuccess(certificate);
  } catch (error) {
    return apiError(error);
  }
}
