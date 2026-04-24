import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { createTrainerPerformanceGetHandler } from "../../../app/api/trainers/[trainerId]/performance/handler";

describe("GET /api/trainers/[trainerId]/performance", () => {
  it("returns performance payload for authorized users", async () => {
    let requiredPermission: string | null = null;

    const handler = createTrainerPerformanceGetHandler({
      requirePermission: async (_request, permissionKey) => {
        requiredPermission = permissionKey;
        return { userId: "user-1" } as never;
      },
      getTrainerPerformanceService: async (trainerId) => ({
        trainerId,
        assignedCourses: 3,
        numberOfLearners: 40,
        completionRate: 75,
        averageLearnerScore: 84.5,
        pendingReviews: 4,
        lastActiveAt: "2026-04-24T08:00:00.000Z",
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/trainers/7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8/performance");
    const response = await handler(request, { params: { trainerId: "7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8" } });
    const payload = (await response.json()) as { data?: { assignedCourses: number }; error?: string };

    assert.equal(response.status, 200);
    assert.equal(requiredPermission, "trainers.view");
    assert.equal(payload.data?.assignedCourses, 3);
  });

  it("returns unauthorized when session is missing", async () => {
    let serviceCalled = false;

    const handler = createTrainerPerformanceGetHandler({
      requirePermission: async () => {
        throw new Error("Unauthorized: authenticated session required.");
      },
      getTrainerPerformanceService: async () => {
        serviceCalled = true;
        return {
          trainerId: "7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8",
          assignedCourses: 0,
          numberOfLearners: 0,
          completionRate: 0,
          averageLearnerScore: 0,
          pendingReviews: 0,
          lastActiveAt: null,
        };
      },
    });

    const request = new NextRequest("http://localhost:3000/api/trainers/7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8/performance");
    const response = await handler(request, { params: { trainerId: "7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8" } });
    const payload = (await response.json()) as { error?: string };

    assert.equal(response.status, 401);
    assert.equal(serviceCalled, false);
    assert.equal(payload.error, "Unauthorized: authenticated session required.");
  });
});
