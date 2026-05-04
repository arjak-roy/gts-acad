"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Link2, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { clearStoredArticleDraft, formatStoredArticleDraftTime, readStoredArticleDraft, writeStoredArticleDraft } from "@/components/modules/course-builder/article-draft-storage";
import { type AuthoredContentDocument, emptyAuthoredContentDocument, convertV1ToHtml } from "@/lib/authored-content";
import { AuthoredContentEditor } from "@/components/modules/course-builder/authored-content-editor";
import { RichContentEditorSheet } from "@/components/modules/course-builder/rich-content-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const CONTENT_TYPES = [
  { value: "ARTICLE", label: "Authored Lesson", comingSoon: false },
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
  bodyJson: AuthoredContentDocument;
  bodyHtml: string;
  estimatedReadingMinutes: string;
  status: string;
  uploadMode: UploadMode;
};

type AddContentArticleDraft = Pick<AddContentForm, "title" | "description" | "bodyJson" | "bodyHtml" | "estimatedReadingMinutes" | "status"> & {
  selectedFolderId: string;
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

type RepositoryFolderOption = {
  id: string;
  pathLabel: string;
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

type UploadTemplate = {
  id: string;
  label: string;
  description: string;
  contentType: string;
  status: string;
  defaultDescription: string;
};

function createInitialForm(): AddContentForm {
  return {
    title: "",
    description: "",
    contentType: "PDF",
    fileUrl: "",
    bodyJson: emptyAuthoredContentDocument(),
    bodyHtml: "",
    estimatedReadingMinutes: "",
    status: "DRAFT",
    uploadMode: "FILES",
  };
}

const UPLOAD_TEMPLATES: UploadTemplate[] = [
  {
    id: "AUTHORED_LESSON",
    label: "Authored Lesson",
    description: "Create a structured lesson with native text and image blocks.",
    contentType: "ARTICLE",
    status: "DRAFT",
    defaultDescription: "Authored lesson content prepared for learner-facing delivery.",
  },
  {
    id: "PREWORK",
    label: "Prework Pack",
    description: "Foundational readings and orientation documents.",
    contentType: "DOCUMENT",
    status: "PUBLISHED",
    defaultDescription: "Prework content aligned for learner onboarding and initial preparation.",
  },
  {
    id: "SESSION_RESOURCE",
    label: "Session Resource",
    description: "In-class handouts and facilitation assets.",
    contentType: "PDF",
    status: "PUBLISHED",
    defaultDescription: "Session-ready material intended for live trainer delivery.",
  },
  {
    id: "ASSESSMENT_REFERENCE",
    label: "Assessment Reference",
    description: "Rubrics, answer keys, and assessment support material.",
    contentType: "DOCUMENT",
    status: "DRAFT",
    defaultDescription: "Reference content supporting assessment authoring and moderation.",
  },
  {
    id: "MEDIA_LAB",
    label: "Media Lab",
    description: "Video and experiential content for blended learning.",
    contentType: "VIDEO",
    status: "DRAFT",
    defaultDescription: "Media asset prepared for blended and language-lab consumption.",
  },
];

function inferContentTypeFromFile(file: File): string {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    return "PDF";
  }

  if (
    name.endsWith(".doc")
    || name.endsWith(".docx")
    || name.endsWith(".ppt")
    || name.endsWith(".pptx")
    || name.endsWith(".xls")
    || name.endsWith(".xlsx")
    || mime.includes("word")
    || mime.includes("presentation")
    || mime.includes("spreadsheet")
  ) {
    return "DOCUMENT";
  }

  if (
    name.endsWith(".mp4")
    || name.endsWith(".mov")
    || name.endsWith(".webm")
    || mime.startsWith("video/")
  ) {
    return "VIDEO";
  }

  return "OTHER";
}

function inferSuggestedContentType(queue: PendingUploadFile[]): string | null {
  if (queue.length === 0) {
    return null;
  }

  const counters = queue.reduce<Record<string, number>>((acc, item) => {
    const inferred = inferContentTypeFromFile(item.file);
    acc[inferred] = (acc[inferred] ?? 0) + 1;
    return acc;
  }, {});

  const ranked = Object.entries(counters).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

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
  repositoryFolderId?: string | null;
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
    if (params.repositoryFolderId) {
      body.set("repositoryFolderId", params.repositoryFolderId);
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
  repositoryFolders = [],
  defaultFolderId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  folders: FolderOption[];
  repositoryFolders?: RepositoryFolderOption[];
  defaultFolderId?: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<AddContentForm>(createInitialForm);
  const [selectedFiles, setSelectedFiles] = useState<PendingUploadFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId ?? "");
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null);
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [richEditorOpen, setRichEditorOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [suggestedContentType, setSuggestedContentType] = useState<string | null>(null);
  const [articleDraftRecoveredAt, setArticleDraftRecoveredAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isArticleContent = form.contentType === "ARTICLE";
  const isLinkContent = form.contentType === "LINK";
  const isScormContent = form.contentType === "SCORM";
  const hasArticleContent = Boolean(form.bodyHtml.trim()) || form.bodyJson.blocks.length > 0;
  const articlePreviewHtml = form.bodyHtml || convertV1ToHtml(form.bodyJson);
  const articleDraftStorageKey = useMemo(() => (
    courseId ? `gts-course-content-article:add:${courseId}` : null
  ), [courseId]);
  const isFileUploadMode = !isArticleContent && !isLinkContent && !isScormContent && form.uploadMode === "FILES";
  const usesRepositoryFolders = repositoryFolders.length > 0;
  const uploadableFiles = selectedFiles.filter((item) => item.status !== "complete");
  const failedUploadCount = useMemo(
    () => selectedFiles.filter((item) => item.status === "failed").length,
    [selectedFiles],
  );
  const completedUploadCount = useMemo(
    () => selectedFiles.filter((item) => item.status === "complete").length,
    [selectedFiles],
  );
  const hasInvalidFileTitles = uploadableFiles.some((item) => !item.title.trim());
  const canSubmit = isScormContent
    ? false
    : isArticleContent
      ? Boolean(form.title.trim() && hasArticleContent)
      : isFileUploadMode
        ? uploadableFiles.length > 0 && !hasInvalidFileTitles
        : Boolean(form.title.trim() && form.fileUrl.trim());
  const selectedFolderLabel = selectedFolderId
    ? (usesRepositoryFolders
      ? (repositoryFolders.find((folder) => folder.id === selectedFolderId)?.pathLabel ?? "Selected folder")
      : (folders.find((folder) => folder.id === selectedFolderId)?.name ?? "Selected folder"))
    : "Repository Root";
  const selectedContentTypeLabel = CONTENT_TYPES.find((type) => type.value === form.contentType)?.label ?? form.contentType;
  const selectedTemplate = UPLOAD_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedFilesTotalBytes = useMemo(
    () => selectedFiles.reduce((sum, item) => sum + item.file.size, 0),
    [selectedFiles],
  );
  const sourceSummaryLabel = isArticleContent
    ? form.bodyHtml.trim().length > 0
      ? "Lesson Studio draft"
      : form.bodyJson.blocks.length > 0
        ? `${form.bodyJson.blocks.length} block${form.bodyJson.blocks.length === 1 ? "" : "s"}`
        : "Start writing"
    : isFileUploadMode
      ? selectedFiles.length > 0
        ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}`
        : "Choose files"
      : form.fileUrl.trim().length > 0
        ? "External URL"
        : "Add a URL";

  useEffect(() => {
    if (!open) {
      setArticleDraftRecoveredAt(null);
      return;
    }

    const storedDraft = readStoredArticleDraft<AddContentArticleDraft>(articleDraftStorageKey);
    if (!storedDraft) {
      setSelectedFolderId(defaultFolderId ?? "");
      setArticleDraftRecoveredAt(null);
      return;
    }

    setForm({
      ...createInitialForm(),
      ...storedDraft.value,
      contentType: "ARTICLE",
    });
    setSelectedFolderId(storedDraft.value.selectedFolderId || defaultFolderId || "");
    setArticleDraftRecoveredAt(storedDraft.updatedAt);
  }, [articleDraftStorageKey, defaultFolderId, open]);

  useEffect(() => {
    if (!open) {
      setForm(createInitialForm());
      setSelectedFiles([]);
      setSelectedFolderId(defaultFolderId ?? "");
      setUploadSession(null);
      setIsDragging(false);
      setSelectedTemplateId("");
      setSuggestedContentType(null);
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

  useEffect(() => {
    if (!isFileUploadMode || selectedFiles.length === 0) {
      setSuggestedContentType(null);
      return;
    }

    const inferred = inferSuggestedContentType(selectedFiles);
    if (!inferred || inferred === form.contentType) {
      setSuggestedContentType(null);
      return;
    }

    setSuggestedContentType(inferred);
  }, [form.contentType, isFileUploadMode, selectedFiles]);

  useEffect(() => {
    if (!open || !articleDraftStorageKey) {
      return;
    }

    if (!isArticleContent) {
      clearStoredArticleDraft(articleDraftStorageKey);
      return;
    }

    const draft: AddContentArticleDraft = {
      title: form.title,
      description: form.description,
      bodyJson: form.bodyJson,
      bodyHtml: form.bodyHtml,
      estimatedReadingMinutes: form.estimatedReadingMinutes,
      status: form.status,
      selectedFolderId,
    };

    const hasMeaningfulDraft = Boolean(
      draft.title.trim()
      || draft.description.trim()
      || draft.bodyHtml.trim()
      || draft.bodyJson.blocks.length > 0
      || draft.estimatedReadingMinutes.trim(),
    );

    if (!hasMeaningfulDraft) {
      clearStoredArticleDraft(articleDraftStorageKey);
      return;
    }

    writeStoredArticleDraft(articleDraftStorageKey, draft);
  }, [articleDraftStorageKey, form, isArticleContent, open, selectedFolderId]);

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

    if (nextContentType !== "ARTICLE") {
      setArticleDraftRecoveredAt(null);
    }

    if (nextContentType === "LINK" || nextContentType === "SCORM" || nextContentType === "ARTICLE") {
      setIsDragging(false);
    }

    if (nextContentType === "ARTICLE") {
      setSelectedFiles([]);
    }
  }

  function applyUploadTemplate(templateId: string) {
    const template = UPLOAD_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(template.id);
    setForm((prev) => ({
      ...prev,
      contentType: template.contentType,
      status: template.status,
      uploadMode: template.contentType === "LINK" ? "URL" : "FILES",
      description: prev.description.trim().length > 0 ? prev.description : template.defaultDescription,
    }));
  }

  function applySuggestedContentType() {
    if (!suggestedContentType) {
      return;
    }

    updateContentType(suggestedContentType);
    setSuggestedContentType(null);
  }

  function appendFiles(files: File[]) {
    if (files.length === 0 || isArticleContent || isLinkContent || isScormContent) {
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

  function retryFailedUploads() {
    if (isSubmitting) {
      return;
    }

    setSelectedFiles((prev) => prev.map((item) => (
      item.status === "failed"
        ? { ...item, status: "queued", progress: 0, error: null }
        : item
    )));
  }

  function clearCompletedUploads() {
    if (isSubmitting) {
      return;
    }

    setSelectedFiles((prev) => prev.filter((item) => item.status !== "complete"));
  }

  async function submitExternalContent() {
    const response = await fetch("/api/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
          folderId: usesRepositoryFolders ? null : (selectedFolderId || null),
          repositoryFolderId: usesRepositoryFolders ? (selectedFolderId || null) : null,
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

  async function submitAuthoredContent() {
    const response = await fetch("/api/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
          folderId: usesRepositoryFolders ? null : (selectedFolderId || null),
          repositoryFolderId: usesRepositoryFolders ? (selectedFolderId || null) : null,
        title: form.title,
        description: form.description,
        contentType: form.contentType,
        bodyJson: form.bodyHtml ? { version: 2, html: form.bodyHtml } : form.bodyJson,
        estimatedReadingMinutes: form.estimatedReadingMinutes.trim().length > 0 ? Number(form.estimatedReadingMinutes) : undefined,
        status: form.status,
        isScorm: false,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Failed to create authored lesson.");
    }

    clearStoredArticleDraft(articleDraftStorageKey);
    setArticleDraftRecoveredAt(null);
    toast.success("Authored lesson created.");
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
          folderId: usesRepositoryFolders ? null : (selectedFolderId || null),
          repositoryFolderId: usesRepositoryFolders ? (selectedFolderId || null) : null,
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
      if (isArticleContent) {
        await submitAuthoredContent();
      } else if (isFileUploadMode) {
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
      <SheetContent className="overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Upload Content</SheetTitle>
          <SheetDescription>
            Upload files, create a lesson, or add a link into this repository location. Advanced presets stay available when you need them.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-1 py-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Type</p>
              <p className="mt-1 text-xs font-semibold text-slate-900">{selectedContentTypeLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Source</p>
              <p className="mt-1 text-xs font-semibold text-slate-900">{sourceSummaryLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Destination</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-900">{selectedFolderLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
              <p className="mt-1 text-xs font-semibold text-slate-900">{form.status}</p>
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Optional quick templates</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Prefill common upload setups when you want a faster start.
                    {selectedTemplate ? ` Current template: ${selectedTemplate.label}.` : ""}
                  </p>
                </div>
                <Badge variant="accent">Optional</Badge>
              </div>
            </summary>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {UPLOAD_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyUploadTemplate(template.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    selectedTemplateId === template.id
                      ? "border-primary bg-primary/5"
                      : "border-[#dde1e6] bg-white hover:border-primary/40"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">{template.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{template.description}</p>
                </button>
              ))}
            </div>
          </details>

          <div className="space-y-2">
            <label className="text-sm font-medium">What are you adding?</label>
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
            {suggestedContentType ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span>Auto-categorization suggests <strong>{suggestedContentType}</strong> based on selected files.</span>
                <Button type="button" size="sm" variant="secondary" onClick={applySuggestedContentType}>
                  Apply suggestion
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destination</label>
            <select
              value={selectedFolderId}
              onChange={(event) => setSelectedFolderId(event.target.value)}
              className="block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
            >
              <option value="">Repository root</option>
              {(usesRepositoryFolders ? repositoryFolders : folders).map((folder) => (
                <option key={folder.id} value={folder.id}>{"pathLabel" in folder ? folder.pathLabel : folder.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {usesRepositoryFolders
                ? (repositoryFolders.length > 0
                  ? "Uploads land in Repository Root unless you choose a global repository folder here."
                  : "Create repository folders in the workspace explorer to organize uploaded assets.")
                : (folders.length > 0
                  ? "Files go to Repository Root unless you choose a folder here."
                  : "Create folders from the content library to organize uploaded assets.")}
            </p>
          </div>

          {isScormContent ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">SCORM package upload is coming soon.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                SCORM 1.2 and 2004 packages will be supported for interactive content delivery.
              </p>
            </div>
          ) : isArticleContent ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Module 1: Introducing the pathway"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2 sm:max-w-[220px]">
                  <label className="text-sm font-medium">Reading time (minutes)</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Optional"
                    value={form.estimatedReadingMinutes}
                    onChange={(event) => setForm((prev) => ({ ...prev, estimatedReadingMinutes: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <label className="text-sm font-medium">Lesson Studio</label>
                    <p className="mt-1 text-xs text-slate-500">Use Lesson Studio as the main authoring space. The old block editor stays available below as a fallback.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 rounded-lg"
                    onClick={() => setRichEditorOpen(true)}
                    disabled={isSubmitting}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Open Lesson Studio
                  </Button>
                </div>
                {articleDraftRecoveredAt ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Recovered an unsaved article draft from {formatStoredArticleDraftTime(articleDraftRecoveredAt)}.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={form.bodyHtml.trim().length > 0 ? "accent" : "info"}>
                        {form.bodyHtml.trim().length > 0 ? "Lesson Studio" : "Legacy blocks"}
                      </Badge>
                      <Badge variant={hasArticleContent ? "default" : "warning"}>
                        {hasArticleContent ? "Draft ready" : "Start your lesson"}
                      </Badge>
                    </div>
                    {hasArticleContent ? (
                      <div
                        className="prose prose-sm mt-4 max-w-none text-slate-700"
                        dangerouslySetInnerHTML={{ __html: articlePreviewHtml }}
                      />
                    ) : (
                      <p className="mt-4 text-sm text-slate-600">Open Lesson Studio to build the lesson with outline, preview, and publish-readiness checks.</p>
                    )}
                  </div>
                )}
                <details className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">Use the legacy block editor instead</summary>
                  <p className="mt-2 text-xs text-slate-500">Keep this for quick structured edits when you do not need the full studio workspace.</p>
                  <div className="mt-4">
                    <AuthoredContentEditor
                      value={form.bodyJson}
                      onChange={(nextBodyJson) => setForm((prev) => ({ ...prev, bodyJson: nextBodyJson }))}
                      disabled={isSubmitting}
                    />
                  </div>
                </details>
              </div>
              <RichContentEditorSheet
                open={richEditorOpen}
                onOpenChange={setRichEditorOpen}
                initialHtml={form.bodyHtml || convertV1ToHtml(form.bodyJson)}
                courseId={courseId}
                draftStorageKey={articleDraftStorageKey ? `${articleDraftStorageKey}:studio` : undefined}
                draftLabel="article"
                onSave={(html) => {
                  setForm((prev) => ({ ...prev, bodyHtml: html }));
                  setRichEditorOpen(false);
                }}
                disabled={isSubmitting}
              />
            </>
          ) : (
            <>
              {!isLinkContent ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">How do you want to add it?</label>
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
                    <p className="mt-3 text-sm font-semibold text-foreground">Drop files here or choose files</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add one file or many. You can rename each file before upload, and the queue will keep track of progress.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Destination: {selectedFolderLabel}</p>
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
                        <div className="flex items-center gap-2">
                          <Badge variant="info">{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"}</Badge>
                          <Badge variant="accent">{formatFileSize(selectedFilesTotalBytes)}</Badge>
                          {failedUploadCount > 0 ? <Badge variant="danger">{failedUploadCount} failed</Badge> : null}
                          {completedUploadCount > 0 ? <Badge variant="success">{completedUploadCount} complete</Badge> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={retryFailedUploads}
                          disabled={isSubmitting || failedUploadCount === 0}
                        >
                          Retry failed
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={clearCompletedUploads}
                          disabled={isSubmitting || completedUploadCount === 0}
                        >
                          Clear completed
                        </Button>
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
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-xs text-muted-foreground">
                      No files selected yet. Choose files above to start the upload queue.
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  rows={3}
                  className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                  placeholder="Add context, learning objective, or facilitator notes for this upload."
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Create as</label>
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
                ? isArticleContent
                  ? "Creating..."
                  : "Uploading..."
                : isFileUploadMode
                  ? uploadableFiles.some((item) => item.status === "failed")
                    ? "Retry Uploads"
                    : `Upload ${uploadableFiles.length > 1 ? `${uploadableFiles.length} Files` : "Content"}`
                  : isArticleContent
                    ? "Create Lesson"
                    : "Create Content"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}