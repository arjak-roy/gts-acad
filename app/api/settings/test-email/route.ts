import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { sendSettingsTestEmailSchema } from "@/lib/validation-schemas/settings";
import { sendSettingsTestEmailService } from "@/services/settings";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.edit);
    const body = await request.json();
    const input = sendSettingsTestEmailSchema.parse(body);
    const result = await sendSettingsTestEmailService(input, {
      actorUserId: session.userId,
      fallbackRecipientEmail: session.email,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}