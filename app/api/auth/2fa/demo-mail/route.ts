import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { sendDemoTwoFactorMail } from "@/services/auth-service";

const demoMailSchema = z.object({
  recipient: z.string().trim().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Demo mail route is disabled in production.");
    }

    await requireAuthenticatedSession(request);
    const body = await request.json().catch(() => ({}));
    const { recipient } = demoMailSchema.parse(body);
    await sendDemoTwoFactorMail(recipient ?? "");
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}