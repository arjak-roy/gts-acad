import type { NextRequest } from "next/server";
import type { CertificateStatus } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listIssuedCertificatesService } from "@/services/certifications";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "certifications.view");

    const searchParams = request.nextUrl.searchParams;
    const filters = {
      courseId: searchParams.get("courseId") ?? undefined,
      programId: searchParams.get("programId") ?? undefined,
      batchId: searchParams.get("batchId") ?? undefined,
      status: (searchParams.get("status") as CertificateStatus) ?? undefined,
      learnerId: searchParams.get("learnerId") ?? undefined,
    };

    const certificates = await listIssuedCertificatesService(filters);
    return apiSuccess(certificates);
  } catch (error) {
    return apiError(error);
  }
}
