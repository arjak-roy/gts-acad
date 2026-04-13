import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createBuddyPersonaSchema, listBuddyPersonasSchema } from "@/lib/validation-schemas/language-lab";
import { createBuddyPersonaService, listBuddyPersonasService } from "@/services/buddy-personas-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "lms.view");
    const input = listBuddyPersonasSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const personas = await listBuddyPersonasService(input);
    return apiSuccess(personas);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "lms.edit");
    const body = await request.json();
    const input = createBuddyPersonaSchema.parse(body);
    const persona = await createBuddyPersonaService(input, { actorUserId: session.userId });
    return apiSuccess(persona, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}