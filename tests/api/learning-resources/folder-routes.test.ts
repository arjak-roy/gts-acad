import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { createFolderListHandler, createFolderCreateHandler } from "../../../app/api/learning-resources/folders/handler";
import { createFolderUpdateHandler, createFolderDeleteHandler } from "../../../app/api/learning-resources/folders/[folderId]/handler";

describe("Learning Resource Folder CRUD", () => {
  describe("GET /api/learning-resources/folders", () => {
    it("returns folders list for authorized users", async () => {
      const folders = [
        { id: "folder-1", parentId: null, name: "Unit 1", description: null, sortOrder: 0, pathLabel: "Unit 1" },
        { id: "folder-2", parentId: "folder-1", name: "Week 1", description: "First week", sortOrder: 0, pathLabel: "Unit 1 / Week 1" },
      ];

      const handler = createFolderListHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        listFoldersService: async () => folders,
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders");
      const response = await handler(request);
      const payload = (await response.json()) as { data?: unknown[] };

      assert.equal(response.status, 200);
      assert.equal(payload.data?.length, 2);
      assert.deepEqual(payload.data?.[0], folders[0]);
    });
  });

  describe("POST /api/learning-resources/folders", () => {
    it("creates a folder and returns 201", async () => {
      let receivedInput: unknown = null;
      let receivedOptions: unknown = null;

      const handler = createFolderCreateHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        createFolderService: async (input, options) => {
          receivedInput = input;
          receivedOptions = options;
          return {
            id: "new-folder-1",
            parentId: null,
            name: input.name,
            description: input.description ?? null,
            sortOrder: input.sortOrder ?? 0,
            pathLabel: input.name,
          };
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Module A", description: "First module", sortOrder: 1 }),
      });

      const response = await handler(request);
      const payload = (await response.json()) as { data?: { id: string; name: string } };

      assert.equal(response.status, 201);
      assert.equal(payload.data?.name, "Module A");
      assert.deepEqual(receivedInput, { name: "Module A", description: "First module", sortOrder: 1 });
      assert.deepEqual(receivedOptions, { actorUserId: "user-1" });
    });

    it("validates name is required", async () => {
      const handler = createFolderCreateHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        createFolderService: async () => {
          throw new Error("Should not be reached.");
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Missing name" }),
      });

      const response = await handler(request);
      assert.equal(response.status, 400);
    });

    it("passes parentId for nested folders", async () => {
      let receivedInput: Record<string, unknown> | null = null;

      const handler = createFolderCreateHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        createFolderService: async (input) => {
          receivedInput = input;
          return {
            id: "child-folder-1",
            parentId: input.parentId ?? null,
            name: input.name,
            description: null,
            sortOrder: 0,
            pathLabel: `Parent / ${input.name}`,
          };
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Child Folder", parentId: "parent-folder-1" }),
      });

      const response = await handler(request);
      const payload = (await response.json()) as { data?: { parentId: string | null } };

      assert.equal(response.status, 201);
      assert.equal(receivedInput!.parentId, "parent-folder-1");
      assert.equal(payload.data?.parentId, "parent-folder-1");
    });
  });

  describe("PATCH /api/learning-resources/folders/[folderId]", () => {
    it("updates folder name and returns updated summary", async () => {
      let receivedInput: Record<string, unknown> | null = null;

      const handler = createFolderUpdateHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        updateFolderService: async (input) => {
          receivedInput = input;
          return {
            id: input.folderId,
            parentId: null,
            name: input.name ?? "Original",
            description: null,
            sortOrder: 0,
            pathLabel: input.name ?? "Original",
          };
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders/folder-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed Folder" }),
      });

      const response = await handler(request, { params: { folderId: "folder-1" } });
      const payload = (await response.json()) as { data?: { name: string } };

      assert.equal(response.status, 200);
      assert.equal(payload.data?.name, "Renamed Folder");
      assert.equal(receivedInput!.folderId, "folder-1");
      assert.equal(receivedInput!.name, "Renamed Folder");
    });

    it("passes parentId change to service", async () => {
      let receivedInput: Record<string, unknown> | null = null;

      const handler = createFolderUpdateHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        updateFolderService: async (input) => {
          receivedInput = input;
          return {
            id: input.folderId,
            parentId: input.parentId ?? null,
            name: "Test",
            description: null,
            sortOrder: 0,
            pathLabel: "Test",
          };
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders/folder-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: "new-parent" }),
      });

      const response = await handler(request, { params: { folderId: "folder-1" } });
      assert.equal(response.status, 200);
      assert.equal(receivedInput!.parentId, "new-parent");
    });
  });

  describe("DELETE /api/learning-resources/folders/[folderId]", () => {
    it("deletes folder and returns success", async () => {
      let deletedId: string | null = null;
      let deleteOptions: unknown = null;

      const handler = createFolderDeleteHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        deleteFolderService: async (folderId, options) => {
          deletedId = folderId;
          deleteOptions = options;
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders/folder-1", {
        method: "DELETE",
      });

      const response = await handler(request, { params: { folderId: "folder-1" } });
      const payload = (await response.json()) as { data?: { success: boolean } };

      assert.equal(response.status, 200);
      assert.equal(payload.data?.success, true);
      assert.equal(deletedId, "folder-1");
      assert.deepEqual(deleteOptions, { actorUserId: "user-1" });
    });

    it("validates folderId is required", async () => {
      const handler = createFolderDeleteHandler({
        requirePermission: async () => ({ userId: "user-1" }),
        deleteFolderService: async () => {
          throw new Error("Should not be reached.");
        },
      });

      const request = new NextRequest("http://localhost:3000/api/learning-resources/folders/", {
        method: "DELETE",
      });

      const response = await handler(request, { params: { folderId: "" } });
      assert.equal(response.status, 400);
    });
  });
});
