"use client";

import { useCallback, useRef, useState } from "react";
import type { LearningResourceUploadConfig } from "@/components/modules/course-builder/learning-resource-client";
import { EMPTY_UPLOAD_STATE, type UploadFileEntry, type UploadState } from "./resource-manager-types";

let nextFileId = 1;

/**
 * Map a MIME type to a learning-resource contentType enum value.
 */
function inferContentType(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (
    mimeType.startsWith("application/vnd.ms-") ||
    mimeType.startsWith("application/vnd.openxmlformats-") ||
    mimeType === "application/msword" ||
    mimeType === "text/csv"
  ) return "DOCUMENT";
  return "OTHER";
}

export function useResourceUpload(options: {
  folderId: string | null;
  uploadConfig: LearningResourceUploadConfig | null;
  onComplete: () => void;
}) {
  const { folderId, uploadConfig, onComplete } = options;
  const [state, setState] = useState<UploadState>(EMPTY_UPLOAD_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const entries: UploadFileEntry[] = files.map((file) => ({
        id: `upload-${nextFileId++}`,
        file,
        title: file.name.replace(/\.[^.]+$/, ""),
        status: "queued" as const,
        progress: 0,
      }));

      setState({
        isUploading: true,
        files: entries,
        completedCount: 0,
        failedCount: 0,
        totalCount: entries.length,
      });

      void processQueue(entries);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folderId],
  );

  async function processQueue(entries: UploadFileEntry[]) {
    const controller = new AbortController();
    abortRef.current = controller;

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < entries.length; i++) {
      if (controller.signal.aborted) break;

      const entry = entries[i];
      setState((prev) => ({
        ...prev,
        files: prev.files.map((f) => (f.id === entry.id ? { ...f, status: "uploading" as const } : f)),
      }));

      try {
        // Step 1: Upload the physical file
        const formData = new FormData();
        formData.append("files", entry.file);
        if (folderId) formData.append("folderId", folderId);
        formData.append("title", entry.title);

        const uploadResponse = await fetch("/api/learning-resources/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!uploadResponse.ok) {
          const body = await uploadResponse.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(body.error || `Upload failed (${uploadResponse.status})`);
        }

        const uploadData = await uploadResponse.json();
        const assets: Array<{
          url: string;
          storagePath: string;
          storageProvider: string;
          fileName: string;
          originalName: string;
          mimeType: string;
          size: number;
        }> = (uploadData.data?.assets ?? uploadData.assets) || [];
        const asset = assets[0];

        if (!asset) {
          throw new Error("Upload succeeded but no asset was returned.");
        }

        // Step 2: Create the learning resource record
        const contentType = inferContentType(asset.mimeType);
        const resourcePayload = {
          title: entry.title,
          contentType,
          status: "DRAFT",
          visibility: "PRIVATE",
          fileUrl: asset.url,
          fileName: asset.fileName,
          fileSize: asset.size,
          mimeType: asset.mimeType,
          storagePath: asset.storagePath,
          storageProvider: asset.storageProvider,
          folderId: folderId || null,
        };

        const createResponse = await fetch("/api/learning-resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resourcePayload),
          signal: controller.signal,
        });

        if (!createResponse.ok) {
          const body = await createResponse.json().catch(() => ({ error: "Failed to create resource" }));
          throw new Error(body.error || `Failed to create resource (${createResponse.status})`);
        }

        completed++;
        setState((prev) => ({
          ...prev,
          completedCount: completed,
          files: prev.files.map((f) => (f.id === entry.id ? { ...f, status: "complete" as const, progress: 100 } : f)),
        }));
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") break;
        failed++;
        setState((prev) => ({
          ...prev,
          failedCount: failed,
          files: prev.files.map((f) =>
            f.id === entry.id ? { ...f, status: "failed" as const, error: (err as Error).message } : f,
          ),
        }));
      }
    }

    setState((prev) => ({ ...prev, isUploading: false }));
    if (completed > 0) onComplete();
  }

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    setState(EMPTY_UPLOAD_STATE);
  }, []);

  const clearUploadState = useCallback(() => {
    setState(EMPTY_UPLOAD_STATE);
  }, []);

  return { uploadState: state, startUpload, cancelUpload, clearUploadState };
}
