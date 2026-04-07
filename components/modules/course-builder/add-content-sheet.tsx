"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Link2, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const CONTENT_TYPES = [
  { value: "PDF", label: "PDF", comingSoon: false },
  { value: "DOCUMENT", label: "Document", comingSoon: false },
  { value: "VIDEO", label: "Video", comingSoon: false },
  { value: "LINK", label: "Link", comingSoon: false },
  { value: "SCORM", label: "SCORM Package", comingSoon: true },
  { value: "OTHER", label: "Other", comingSoon: false },
] as const;

type UploadMode = "FILES" | "URL";
type UploadStatus = "queued" | "uploading" | "complete" | "failed";

type AddContentForm = {
  title: string;
  description: string;
  contentType: string;
  fileUrl: string;
  status: string;
  uploadMode: UploadMode;
};

type UploadConfig = {
  maximumFileUploadSizeMb: number;
  allowedFileTypes: string[];
  allowedImageTypes: string[];
  storageLocation: "LOCAL_PUBLIC" | "S3";
  enableDocumentPreview: boolean;
};

type FolderOption = {
  id: string;
  name: string;
  contentCount: number;
};

type PendingUploadFile = {
  id: string;
  file: File;
  title: string;
  progress: number;
  status: UploadStatus;
  error: string | null;
};

type UploadResponse = {
  data?: {
    createdCount?: number;
    failed?: Array<{ fileName: string; error: string }>;
  };
  error?: string;
};

type UploadSession = {
  overallProgress: number;
  activeFileName: string | null;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  uploadedBytes: number;
  totalBytes: number;
};

const initialForm: AddContentForm = {
  title: "",
  description: "",
  contentType: "PDF",
  fileUrl: "",
  status: "DRAFT",
  uploadMode: "FILES",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function buildTitleFromFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const normalized = baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (normalized || "Untitled content").slice(0, 255);
}

function createPendingUploadFile(file: File): PendingUploadFile {
  return {
    id: buildFileKey(file),
    file,
    title: buildTitleFromFileName(file.name),
    progress: 0,
    status: "queued",
    error: null,
  };
}

function mergeFiles(current: PendingUploadFile[], incoming: File[]) {
  const next = [...current];
  const seen = new Set(current.map((item) => item.id));

  for (const file of incoming) {
    const id = buildFileKey(file);
    if (seen.has(id)) {
      continue;
    }

    next.push(createPendingUploadFile(file));
    seen.add(id);
  }

  return next;
}

function getAcceptValue(config: UploadConfig | null) {
  if (!config) {
    return undefined;
  }

  const extensions = Array.from(
    new Set(
      [...config.allowedFileTypes, ...config.allowedImageTypes]
        .map((value) => value.trim().toLowerCase().replace(/^[.]+/, ""))
        .filter(Boolean),
    ),
  );

  return extensions.length > 0 ? extensions.map((value) => `.${value}`).join(",") : undefined;
}

function getUploadStatusBadgeVariant(status: UploadStatus): "default" | "info" | "success" | "danger" {
  switch (status) {
    case "uploading":
      return "info";
    case "complete":
      return "success";
    case "failed":
      return "danger";
    default:
      return "default";
  }
}

function uploadContentFile(params: {
  courseId: string;
  folderId?: string | null;
  description: string;
  contentType: string;
  status: string;
  item: PendingUploadFile;
  onProgress: (loaded: number, total: number) => void;
}) {
  return new Promise<UploadResponse>((resolve, reject) => {
    const body = new FormData();
    body.set("courseId", params.courseId);
    if (params.folderId) {
      body.set("folderId", params.folderId);
    }
    body.set("description", params.description);
    body.set("contentType", params.contentType);
    body.set("status", params.status);
    body.set("title", params.item.title.trim());
    body.append("files", params.item.file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/course-content/upload");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        params.onProgress(event.loaded, event.total);
      }
    };

    request.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };

    request.onload = () => {
      let payload: UploadResponse = {};

      if (request.responseText) {
        try {
          payload = JSON.parse(request.responseText) as UploadResponse;
        } catch {
          payload = {};
        }
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error || `Upload failed with status ${request.status}.`));
    };

    request.send(body);
  });
}

export function AddContentSheet({
  open,
  onOpenChange,
  courseId,
  folders,
  defaultFolderId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  folders: FolderOption[];
  defaultFolderId?: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<AddContentForm>(initialForm);
  const [selectedFiles, setSelectedFiles] = useState<PendingUploadFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId ?? "");
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null);
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isLinkContent = form.contentType === "LINK";
  const isScormContent = form.contentType === "SCORM";
  const isFileUploadMode = !isLinkContent && !isScormContent && form.uploadMode === "FILES";
  const uploadableFiles = selectedFiles.filter((item) => item.status !== "complete");
  const hasInvalidFileTitles = uploadableFiles.some((item) => !item.title.trim());
  const canSubmit = isScormContent
    ? false
    : isFileUploadMode
      ? uploadableFiles.length > 0 && !hasInvalidFileTitles
      : Boolean(form.title.trim() && form.fileUrl.trim());

  useEffect(() => {
    if (open) {
      setSelectedFolderId(defaultFolderId ?? "");
    }
  }, [defaultFolderId, open]);

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setSelectedFiles([]);
      setSelectedFolderId(defaultFolderId ?? "");
      setUploadSession(null);
      setIsDragging(false);
      return;
    }

    if (uploadConfig || isLoadingConfig) {
      return;
    }

    let cancelled = false;

    async function loadUploadConfig() {
      setIsLoadingConfig(true);

      try {
        const response = await fetch("/api/course-content/upload", { cache: "no-store" });
        const payload = (await response.json()) as { data?: UploadConfig; error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load upload configuration.");
        }

        if (!cancelled) {
          setUploadConfig(payload.data ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load upload configuration.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    }

    void loadUploadConfig();

    return () => {
      cancelled = true;
    };
  }, [defaultFolderId, isLoadingConfig, open, uploadConfig]);

  function handleSheetOpenChange(nextOpen: boolean) {
    if (isSubmitting) {
      return;
    }

    onOpenChange(nextOpen);
  }

  function updateContentType(nextContentType: string) {
    setForm((prev) => ({
      ...prev,
      contentType: nextContentType,
      uploadMode: nextContentType === "LINK" ? "URL" : prev.contentType === "LINK" ? "FILES" : prev.uploadMode,
    }));

    if (nextContentType === "LINK" || nextContentType === "SCORM") {
      setIsDragging(false);
    }
  }

  function appendFiles(files: File[]) {
    if (files.length === 0 || isLinkContent || isScormContent) {
      return;
    }

    setSelectedFiles((prev) => mergeFiles(prev, files));
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    appendFiles(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!isFileUploadMode) {
      return;
    }

    appendFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function updateFileTitle(fileId: string, title: string) {
    setSelectedFiles((prev) => prev.map((item) => (item.id === fileId ? { ...item, title } : item)));
  }

  function removeFile(fileId: string) {
    if (isSubmitting) {
      return;
    }

    setSelectedFiles((prev) => prev.filter((item) => item.id !== fileId));
  }

  async function submitExternalContent() {
    const response = await fetch("/api/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        folderId: selectedFolderId || null,
        title: form.title,
        description: form.description,
        contentType: form.contentType,
        fileUrl: form.fileUrl,
        fileName: form.title,
        status: form.status,
        isScorm: false,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Failed to create content.");
    }

    toast.success("Content item created.");
    onCreated();
    onOpenChange(false);
  }

  async function submitUploadedFiles() {
    const queue = selectedFiles.filter((item) => item.status !== "complete");

    if (queue.length === 0) {
      toast.info("All selected files are already uploaded.");
      return;
    }

    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    let processedBytes = 0;
    let createdCount = 0;
    let failedCount = 0;

    setSelectedFiles((prev) => prev.map((item) => (
      item.status === "complete"
        ? item
        : { ...item, status: "queued", progress: 0, error: null }
    )));

    setUploadSession({
      overallProgress: 0,
      activeFileName: null,
      totalFiles: queue.length,
      completedFiles: 0,
      failedFiles: 0,
      uploadedBytes: 0,
      totalBytes,
    });

    for (const item of queue) {
      setSelectedFiles((prev) => prev.map((entry) => (
        entry.id === item.id
          ? { ...entry, status: "uploading", progress: 0, error: null }
          : entry
      )));

      try {
        await uploadContentFile({
          courseId,
          folderId: selectedFolderId || null,
          description: form.description,
          contentType: form.contentType,
          status: form.status,
          item,
          onProgress: (loaded, total) => {
            const fileProgress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
            const uploadedBytes = Math.min(totalBytes, processedBytes + loaded);
            const overallProgress = totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)) : 100;

            setSelectedFiles((prev) => prev.map((entry) => (
              entry.id === item.id
                ? { ...entry, progress: fileProgress }
                : entry
            )));

            setUploadSession((prev) => prev ? {
              ...prev,
              activeFileName: item.file.name,
              overallProgress,
              uploadedBytes,
              completedFiles: createdCount,
              failedFiles: failedCount,
            } : prev);
          },
        });

        processedBytes += item.file.size;
        createdCount += 1;

        setSelectedFiles((prev) => prev.map((entry) => (
          entry.id === item.id
            ? { ...entry, status: "complete", progress: 100, error: null }
            : entry
        )));

        setUploadSession((prev) => prev ? {
          ...prev,
          activeFileName: item.file.name,
          completedFiles: createdCount,
          failedFiles: failedCount,
          uploadedBytes: processedBytes,
          overallProgress: totalBytes > 0 ? Math.min(100, Math.round((processedBytes / totalBytes) * 100)) : 100,
        } : prev);
      } catch (error) {
        processedBytes += item.file.size;
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Failed to upload file.";

        setSelectedFiles((prev) => prev.map((entry) => (
          entry.id === item.id
            ? { ...entry, status: "failed", error: message }
            : entry
        )));

        setUploadSession((prev) => prev ? {
          ...prev,
          activeFileName: item.file.name,
          completedFiles: createdCount,
          failedFiles: failedCount,
          uploadedBytes: processedBytes,
          overallProgress: totalBytes > 0 ? Math.min(100, Math.round((processedBytes / totalBytes) * 100)) : 100,
        } : prev);
      }
    }

    setUploadSession((prev) => prev ? {
      ...prev,
      activeFileName: null,
      overallProgress: 100,
      uploadedBytes: totalBytes,
      completedFiles: createdCount,
      failedFiles: failedCount,
    } : prev);

    if (createdCount > 0) {
      onCreated();
    }

    if (failedCount > 0) {
      toast.warning(`${createdCount} content item${createdCount === 1 ? "" : "s"} created. ${failedCount} upload${failedCount === 1 ? "" : "s"} failed.`);
      return;
    }

    toast.success(`${createdCount} content item${createdCount === 1 ? "" : "s"} created.`);
    onOpenChange(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isScormContent) {
      toast.info("SCORM package upload is coming soon.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isFileUploadMode) {
        await submitUploadedFiles();
      } else {
        await submitExternalContent();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create content.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Upload Content</SheetTitle>
          <SheetDescription>
            Upload one or more files for this course, edit titles before submit, or register an external URL when the asset is hosted elsewhere.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-1 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Content Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`relative rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    form.contentType === type.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/50"
                  } ${type.comingSoon ? "opacity-60" : ""}`}
                  onClick={() => updateContentType(type.value)}
                >
                  {type.label}
                  {type.comingSoon ? (
                    <Badge variant="accent" className="absolute -right-1 -top-2 text-[8px] px-1 py-0">
                      Soon
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Folder</label>
            <select
              value={selectedFolderId}
              onChange={(event) => setSelectedFolderId(event.target.value)}
              className="block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
            >
              <option value="">Unfiled library</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {folders.length > 0
                ? "Choose the folder these content items should be added to."
                : "Create folders from the content library to organize uploaded assets."}
            </p>
          </div>

          {isScormContent ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">SCORM package upload is coming soon.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                SCORM 1.2 and 2004 packages will be supported for interactive content delivery.
              </p>
            </div>
          ) : (
            <>
              {!isLinkContent ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                        form.uploadMode === "FILES"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, uploadMode: "FILES" }))}
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      Upload files
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                        form.uploadMode === "URL"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, uploadMode: "URL" }))}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      External URL
                    </button>
                  </div>
                </div>
              ) : null}

              {(isLinkContent || form.uploadMode === "URL") ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      placeholder={isLinkContent ? "e.g., Reading portal" : "e.g., Module handout"}
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{isLinkContent ? "Link URL" : "File URL"}</label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={form.fileUrl}
                      onChange={(event) => setForm((prev) => ({ ...prev, fileUrl: event.target.value }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {isLinkContent
                        ? "Use this for live resources, LMS pages, or other external learning links."
                        : "Use this when the asset is managed outside the platform but still needs to appear in the course library."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3 rounded-xl border border-dashed p-4">
                  <div
                    className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                      isDragging ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50/70"
                    }`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (isFileUploadMode) {
                        setIsDragging(true);
                      }
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (event.currentTarget === event.target) {
                        setIsDragging(false);
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (isFileUploadMode) {
                        setIsDragging(true);
                      }
                    }}
                    onDrop={handleDrop}
                  >
                    <UploadCloud className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-3 text-sm font-semibold text-foreground">Drag and drop files here</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload multiple files at once. You can adjust each title before submit, and the sheet will show live progress while the queue uploads.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-4"
                      disabled={isSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isLoadingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      Browse files
                    </Button>
                    <input
                      ref={fileInputRef}
                      className="hidden"
                      type="file"
                      multiple
                      accept={getAcceptValue(uploadConfig)}
                      onChange={handleFileInputChange}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">Max {uploadConfig?.maximumFileUploadSizeMb ?? "..."} MB per file</Badge>
                    <Badge variant="default">
                      {uploadConfig?.storageLocation === "S3" ? "Stored in S3" : "Stored in public uploads"}
                    </Badge>
                    {uploadConfig ? (
                      <Badge variant="accent">
                        {Array.from(new Set([...uploadConfig.allowedFileTypes, ...uploadConfig.allowedImageTypes])).join(", ") || "All configured types"}
                      </Badge>
                    ) : null}
                  </div>

                  {uploadSession ? (
                    <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Upload progress</p>
                          <p className="text-xs text-muted-foreground">
                            {uploadSession.activeFileName
                              ? `Uploading ${uploadSession.activeFileName}`
                              : `${uploadSession.completedFiles} completed · ${uploadSession.failedFiles} failed`}
                          </p>
                        </div>
                        <Badge variant="info">{uploadSession.overallProgress}%</Badge>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0d3b84] to-cyan-500 transition-all"
                          style={{ width: `${uploadSession.overallProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{uploadSession.completedFiles}/{uploadSession.totalFiles} uploaded</span>
                        <span>{formatFileSize(uploadSession.uploadedBytes)} / {formatFileSize(uploadSession.totalBytes)}</span>
                      </div>
                    </div>
                  ) : null}

                  {selectedFiles.length > 0 ? (
                    <div className="space-y-2 rounded-xl border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Selected files</p>
                        <Badge variant="info">{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"}</Badge>
                      </div>

                      <div className="space-y-3">
                        {selectedFiles.map((item) => (
                          <div key={item.id} className="rounded-lg border px-3 py-3">
                            <div className="flex items-start gap-3">
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                                  <Badge variant={getUploadStatusBadgeVariant(item.status)}>{item.status}</Badge>
                                  <Badge variant="info">{form.contentType}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Title</label>
                                  <Input
                                    value={item.title}
                                    disabled={isSubmitting || item.status === "complete"}
                                    maxLength={255}
                                    onChange={(event) => updateFileTitle(item.id, event.target.value)}
                                  />
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      item.status === "failed"
                                        ? "bg-rose-500"
                                        : item.status === "complete"
                                          ? "bg-emerald-500"
                                          : "bg-[#0d3b84]"
                                    }`}
                                    style={{ width: `${Math.max(item.progress, item.status === "complete" ? 100 : 0)}%` }}
                                  />
                                </div>
                                {item.error ? (
                                  <div className="flex items-start gap-2 text-xs text-rose-600">
                                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>{item.error}</span>
                                  </div>
                                ) : item.status === "complete" ? (
                                  <div className="flex items-start gap-2 text-xs text-emerald-600">
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>Uploaded successfully.</span>
                                  </div>
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                disabled={isSubmitting || item.status === "uploading"}
                                onClick={() => removeFile(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No files selected yet.</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Brief description of this content"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-2">
                  {["DRAFT", "PUBLISHED"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        form.status === status
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, status }))}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <SheetFooter className="pt-2">
            <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting
                ? "Uploading…"
                : isFileUploadMode
                  ? uploadableFiles.some((item) => item.status === "failed")
                    ? "Retry Uploads"
                    : `Upload ${uploadableFiles.length > 1 ? `${uploadableFiles.length} Files` : "Content"}`
                  : "Create Content"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}