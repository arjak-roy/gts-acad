"use server";

import { assertCanAccessLearnerCode, requireCurrentAuthSession, requireModuleAccess } from "@/lib/auth/access";
import { getLearnersSchema, learnerIdSchema } from "@/lib/validation-schemas/learners";
import { getLearnerByCodeService, getLearnersService } from "@/services/learners-service";

/**
 * Parses list filters coming from route search params or API adapters.
 * Delegates sorting, paging, and fallback behavior to the service layer.
 * Returns a stable response contract for table rendering and pagination UI.
 */
export async function getLearners(input: unknown) {
  const session = await requireCurrentAuthSession();

  requireModuleAccess(session, "learners");

  const parsed = getLearnersSchema.parse(input);
  return getLearnersService(parsed);
}

/**
 * Validates learner identity input before requesting detailed profile data.
 * Calls the service to resolve DB-backed or mock-backed learner information.
 * Keeps detail access centralized so all consumers share one lookup rule.
 */
export async function getLearnerByCode(input: unknown) {
  const session = await requireCurrentAuthSession();
  const parsed = learnerIdSchema.parse(input);
  await assertCanAccessLearnerCode(session, parsed.learnerCode);
  return getLearnerByCodeService(parsed.learnerCode);
}