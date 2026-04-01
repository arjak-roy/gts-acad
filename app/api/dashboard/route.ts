import { getDashboardStatsSchema } from "@/lib/validation-schemas/dashboard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getDashboardStatsService } from "@/services/dashboard-service";

/**
 * Returns dashboard KPI and trend payload for external consumers.
 * Validates the route contract before calling the service layer.
 * Converts thrown errors into consistent API responses.
 */
export async function GET() {
  try {
    getDashboardStatsSchema.parse({});
    const stats = await getDashboardStatsService();
    return apiSuccess(stats);
  } catch (error) {
    return apiError(error);
  }
}