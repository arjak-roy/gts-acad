import { NextRequest } from "next/server";
import { z } from "zod";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { activateAccountWithToken } from "@/services/auth/account-activation";

const activateAccountSchema = z.object({
  token: z.string().trim().min(1, "Activation token is required."),
});

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token } = activateAccountSchema.parse(body);
    const result = await activateAccountWithToken(token);

    return withCors(request, apiSuccess({ ok: true, ...result }), ["POST", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "OPTIONS"]);
  }
}