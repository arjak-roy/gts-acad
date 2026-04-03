"use server";

import { requireCurrentModuleAccess } from "@/lib/auth/access";
import { searchDashboardService } from "@/services/dashboard-search-service";
import { DashboardSearchInput } from "@/lib/validation-schemas/dashboard";
import { DashboardSearchResult } from "@/types";

export async function searchAction(input: DashboardSearchInput): Promise<DashboardSearchResult> {
  await requireCurrentModuleAccess("dashboard");
  return searchDashboardService(input);
}
