"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { buildActionCandidateSessionCookie, createCandidateSessionToken, FULL_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const candidateLoginSchema = z.object({
  learnerCode: z.string().trim().min(2, "Learner code is required."),
  email: z.string().trim().email("Valid email is required."),
});

export async function loginCandidate(formData: FormData) {
  const parsed = candidateLoginSchema.safeParse({
    learnerCode: formData.get("learnerCode"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid login details." };
  }

  const learner = await prisma.learner.findFirst({
    where: {
      learnerCode: parsed.data.learnerCode,
      email: { equals: parsed.data.email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      learnerCode: true,
      fullName: true,
    },
  });

  if (!learner) {
    return { ok: false as const, error: "Invalid learner code or email." };
  }

  const token = await createCandidateSessionToken(
    {
      learnerId: learner.id,
      learnerCode: learner.learnerCode,
      name: learner.fullName,
      state: "authenticated",
    },
    FULL_SESSION_MAX_AGE_SECONDS,
  );

  cookies().set(buildActionCandidateSessionCookie(token, FULL_SESSION_MAX_AGE_SECONDS));

  return { ok: true as const };
}