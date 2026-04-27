import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getTrainerCalendar } from "@/services/trainers";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "trainers.view");
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      throw new Error("Both 'from' and 'to' query parameters are required.");
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error("Invalid date format for 'from' or 'to' parameters.");
    }

    if (toDate.getTime() <= fromDate.getTime()) {
      throw new Error("'to' must be after 'from'.");
    }

    const events = await getTrainerCalendar(params.trainerId, fromDate, toDate);
    return apiSuccess(events);
  } catch (error) {
    return apiError(error);
  }
}
