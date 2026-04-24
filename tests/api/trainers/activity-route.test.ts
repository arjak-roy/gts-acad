import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { createTrainerActivityGetHandler } from "../../../app/api/trainers/[trainerId]/activity/handler";

describe("GET /api/trainers/[trainerId]/activity", () => {
  it("parses pagination params and returns paginated response", async () => {
    let serviceInput: { trainerId: string; page: number; pageSize: number } | null = null;

    const handler = createTrainerActivityGetHandler({
      requirePermission: async () => ({ userId: "user-1" } as never),
      listTrainerActivityService: async (input) => {
        serviceInput = input;

        return {
          items: [
            {
              id: "evt-1",
              type: "LOGIN",
              title: "Signed in",
              occurredAt: "2026-04-24T08:00:00.000Z",
              metadata: {},
            },
          ],
          totalCount: 24,
          page: input.page,
          pageSize: input.pageSize,
          pageCount: 3,
        };
      },
    });

    const request = new NextRequest("http://localhost:3000/api/trainers/7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8/activity?page=2&pageSize=10");
    const response = await handler(request, { params: { trainerId: "7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8" } });
    const payload = (await response.json()) as { data?: { page: number; pageSize: number; totalCount: number }; error?: string };

    assert.equal(response.status, 200);
    assert.deepEqual(serviceInput, {
      trainerId: "7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8",
      page: 2,
      pageSize: 10,
    });
    assert.equal(payload.data?.page, 2);
    assert.equal(payload.data?.pageSize, 10);
    assert.equal(payload.data?.totalCount, 24);
  });

  it("returns forbidden when permission check fails", async () => {
    let serviceCalled = false;

    const handler = createTrainerActivityGetHandler({
      requirePermission: async () => {
        throw new Error("Forbidden: insufficient permissions.");
      },
      listTrainerActivityService: async () => {
        serviceCalled = true;
        return {
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
          pageCount: 1,
        };
      },
    });

    const request = new NextRequest("http://localhost:3000/api/trainers/7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8/activity");
    const response = await handler(request, { params: { trainerId: "7f5b8f7e-8d95-4c0f-93fa-4782fcf63fb8" } });
    const payload = (await response.json()) as { error?: string };

    assert.equal(response.status, 403);
    assert.equal(serviceCalled, false);
    assert.equal(payload.error, "Forbidden: insufficient permissions.");
  });
});
