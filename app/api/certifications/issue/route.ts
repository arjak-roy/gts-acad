import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { issueCertificateSchema, bulkIssueCertificatesSchema } from "@/lib/validation-schemas/certifications";
import { issueCertificateService, bulkIssueCertificatesService } from "@/services/certifications";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "certifications.issue");
    const body = await request.json();

    // Bulk if learnerIds array is present, otherwise single
    if (Array.isArray(body.learnerIds)) {
      const input = bulkIssueCertificatesSchema.parse(body);
      const result = await bulkIssueCertificatesService(input, { actorUserId: session.userId });
      return apiSuccess(result, { status: 201 });
    }

    const input = issueCertificateSchema.parse(body);
    const cert = await issueCertificateService(input, { actorUserId: session.userId });
    return apiSuccess(cert, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
