import { apiError, apiSuccess } from "@/lib/api-response";
import { createLearnerSchema, getLearnersSchema } from "@/lib/validation-schemas/learners";
import { createLearnerService, getLearnersService } from "@/services/learners-service";

/**
 * Serves paginated learner collections for table and integration clients.
 * Parses query-string filters using the learners validation schema.
 * Returns normalized success or error payloads for predictable consumption.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = getLearnersSchema.parse(Object.fromEntries(searchParams.entries()));
    const learners = await getLearnersService(input);
    return apiSuccess(learners);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Creates a learner candidate from enrollment form input.
 * Validates JSON payload with shared schema before DB writes.
 * Returns created learner in standardized API envelope.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createLearnerSchema.parse(body);
    const learner = await createLearnerService(input);
    return apiSuccess(learner, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}