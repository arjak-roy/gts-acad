import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import {
  createBatchContentListHandler,
  createBatchContentAssignHandler,
  createBatchContentRemoveHandler,
} from "../../../app/api/batch-content/handler";
import type { BatchAvailableContentItem } from "../../../services/batch-content/types";

describe("Batch Content Resource Assignment", () => {
  describe("GET /api/batch-content?type=content", () => {
    it("returns assigned content items with resource overlays", async () => {
      const items = [
        {
          id: "course:batch-1:content-1",
          batchId: "batch-1",
          contentId: "content-1",
          resourceId: "resource-1",
          resourceAssignmentId: "assignment-1",
          contentTitle: "Intro to React",
          contentDescription: null,
          contentExcerpt: null,
          contentType: "ARTICLE",
          contentStatus: "PUBLISHED",
          folderName: null,
          estimatedReadingMinutes: 5,
          fileUrl: null,
          fileName: null,
          mimeType: null,
          assignedByName: "Admin",
          assignedAt: new Date().toISOString(),
          assignmentSource: "COURSE_AND_BATCH",
          isInheritedFromCourse: true,
          isBatchMapped: true,
          canRemoveBatchMapping: true,
        },
      ];

      const handler = createBatchContentListHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        listBatchContentService: async (batchId, options) => {
          assert.equal(batchId, "batch-1");
          assert.equal(options?.includeAssignedResources, true);
          return items as never[];
        },
        getAvailableContentForBatchService: async () => [],
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content?batchId=batch-1&type=content");
      const response = await handler(request);
      const payload = (await response.json()) as { data?: unknown[] };

      assert.equal(response.status, 200);
      assert.equal(payload.data?.length, 1);
    });

    it("returns available repository resources when available=true", async () => {
      const available: BatchAvailableContentItem[] = [
        {
          id: "resource-2",
          sourceContentId: "content-2",
          title: "Advanced CSS",
          contentType: "ARTICLE" as const,
          fileName: null,
          folderName: "Frontend",
          sourceCourseName: "Web Dev",
          hasSourceContent: true,
        },
      ];

      const handler = createBatchContentListHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        listBatchContentService: async () => [],
        getAvailableContentForBatchService: async (batchId) => {
          assert.equal(batchId, "batch-1");
          return available;
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content?batchId=batch-1&type=content&available=true");
      const response = await handler(request);
      const payload = (await response.json()) as { data?: { id: string; title: string }[] };

      assert.equal(response.status, 200);
      assert.equal(payload.data?.length, 1);
      assert.equal(payload.data?.[0].title, "Advanced CSS");
    });

    it("returns 400 when batchId is missing", async () => {
      const handler = createBatchContentListHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        listBatchContentService: async () => [],
        getAvailableContentForBatchService: async () => [],
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content?type=content");
      const response = await handler(request);
      assert.equal(response.status, 400);
    });
  });

  describe("POST /api/batch-content (resource assignment)", () => {
    it("assigns repository resources to batch via resourceIds", async () => {
      let receivedInput: Record<string, unknown> | null = null;
      let receivedOptions: unknown = null;

      const handler = createBatchContentAssignHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        assignContentToBatchService: async (input, options) => {
          receivedInput = input;
          receivedOptions = options;
          return input.resourceIds.length;
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "content",
          batchId: "batch-1",
          resourceIds: ["resource-1", "resource-2"],
        }),
      });

      const response = await handler(request);
      const payload = (await response.json()) as { data?: { assigned: number } };

      assert.equal(response.status, 201);
      assert.equal(payload.data?.assigned, 2);
      assert.equal(receivedInput!.batchId, "batch-1");
      assert.deepEqual(receivedInput!.resourceIds, ["resource-1", "resource-2"]);
      assert.deepEqual(receivedInput!.contentIds, []);
      assert.deepEqual(receivedOptions, { actorUserId: "user-1" });
    });

    it("rejects when neither contentIds nor resourceIds are provided", async () => {
      const handler = createBatchContentAssignHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        assignContentToBatchService: async () => {
          throw new Error("Should not be reached.");
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content", batchId: "batch-1" }),
      });

      const response = await handler(request);
      assert.equal(response.status, 400);
    });

    it("rejects when both contentIds and resourceIds are provided", async () => {
      const handler = createBatchContentAssignHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        assignContentToBatchService: async () => {
          throw new Error("Should not be reached.");
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "content",
          batchId: "batch-1",
          contentIds: ["content-1"],
          resourceIds: ["resource-1"],
        }),
      });

      const response = await handler(request);
      assert.equal(response.status, 400);
    });
  });

  describe("DELETE /api/batch-content (resource removal)", () => {
    it("removes a resource assignment by assignmentId and resourceId", async () => {
      let receivedInput: Record<string, unknown> | null = null;

      const handler = createBatchContentRemoveHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        removeContentFromBatchService: async (input) => {
          receivedInput = input;
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "content",
          batchId: "batch-1",
          resourceId: "resource-1",
          assignmentId: "assignment-1",
        }),
      });

      const response = await handler(request);
      const payload = (await response.json()) as { data?: { removed: boolean } };

      assert.equal(response.status, 200);
      assert.equal(payload.data?.removed, true);
      assert.equal(receivedInput!.batchId, "batch-1");
      assert.equal(receivedInput!.resourceId, "resource-1");
      assert.equal(receivedInput!.assignmentId, "assignment-1");
    });

    it("removes a legacy content mapping by contentId", async () => {
      let receivedInput: Record<string, unknown> | null = null;

      const handler = createBatchContentRemoveHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        removeContentFromBatchService: async (input) => {
          receivedInput = input;
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "content",
          batchId: "batch-1",
          contentId: "content-1",
        }),
      });

      const response = await handler(request);
      assert.equal(response.status, 200);
      assert.equal(receivedInput!.contentId, "content-1");
    });

    it("rejects when no contentId or resourceId+assignmentId are provided", async () => {
      const handler = createBatchContentRemoveHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        removeContentFromBatchService: async () => {
          throw new Error("Should not be reached.");
        },
      });

      const request = new NextRequest("http://localhost:3000/api/batch-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content", batchId: "batch-1" }),
      });

      const response = await handler(request);
      assert.equal(response.status, 400);
    });
  });
});
