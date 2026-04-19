import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCertificateByVerificationCodeService } from "@/services/certifications";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const certificate = await getCertificateByVerificationCodeService(code);

    if (!certificate) {
      return apiError(new Error("Certificate not found or has been revoked."));
    }

    return apiSuccess(certificate);
  } catch (error) {
    return apiError(error);
  }
}
