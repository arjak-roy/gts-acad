import type { NextRequest } from "next/server";
import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { listCertificatesForLearnerService } from "@/services/certifications";

const METHODS = ["GET", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const certificates = await listCertificatesForLearnerService(session.userId);
    const response = apiSuccess(certificates);
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}
