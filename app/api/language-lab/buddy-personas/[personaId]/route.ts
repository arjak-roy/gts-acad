import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { buddyPersonaIdSchema, updateBuddyPersonaSchema } from "@/lib/validation-schemas/language-lab";
import { getBuddyPersonaByIdService, updateBuddyPersonaService } from "@/services/buddy-personas-service";

type RouteContext = {
  params: {
    personaId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "lms.view");
    const { personaId } = buddyPersonaIdSchema.parse(params);
    const persona = await getBuddyPersonaByIdService(personaId);

    if (!persona) {
      throw new Error("Buddy persona not found.");
    }

    return apiSuccess(persona);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "lms.edit");
    const { personaId } = buddyPersonaIdSchema.parse(params);
    const body = await request.json();
    const input = updateBuddyPersonaSchema.parse(body);
    const persona = await updateBuddyPersonaService(personaId, input, { actorUserId: session.userId });
    return apiSuccess(persona);
  } catch (error) {
    return apiError(error);
  }
}