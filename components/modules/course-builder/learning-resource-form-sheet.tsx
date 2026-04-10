"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { emptyAuthoredContentDocument, type AuthoredContentDocument } from "@/lib/authored-content";
import { AuthoredContentEditor } from "@/components/modules/course-builder/authored-content-editor";
import {
  buildLearningResourceAssetDraftFromUpload,
  EMPTY_LEARNING_RESOURCE_LOOKUPS,
  formatFileSize,
  getLearningResourceCategoryLabel,
  LEARNING_RESOURCE_CONTENT_TYPE_OPTIONS,
  LEARNING_RESOURCE_STATUS_OPTIONS,
  LEARNING_RESOURCE_VISIBILITY_OPTIONS,
  parseApiResponse,
  parseTagInput,
  type LearningResourceAssetDraft,
  type LearningResourceContentType,
  type LearningResourceDetail,
  type LearningResourceLookups,
  type LearningResourceStatus,
  type LearningResourceUploadConfig,
  type LearningResourceVisibility,
  type UploadedAsset,
} from "@/components/modules/course-builder/learning-resource-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type LearningResourceFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId?: string | null;
  lookups?: LearningResourceLookups;
  onSaved: () => void;
  createPreset?: LearningResourceFormSeed;
  categoryLocked?: boolean;
  createTitle?: string;
  createDescription?: string;
};

type FormState = {
  title: string;
  description: string;
  excerpt: string;
  contentType: LearningResourceContentType;
  status: LearningResourceStatus;
  visibility: LearningResourceVisibility;
  categoryName: string;
  subcategoryName: string;
  tagsInput: string;
  estimatedReadingMinutes: string;
  sourceUrl: string;
  bodyJson: AuthoredContentDocument;
  changeSummary: string;
};

export type LearningResourceFormSeed = Partial<FormState>;

function createInitialForm(seed?: LearningResourceFormSeed): FormState {
  const defaults: FormState = {
    title: "",
    description: "",
    excerpt: "",
    contentType: "PDF",
    status: "DRAFT",
    visibility: "PRIVATE",
    categoryName: "",
    subcategoryName: "",
    tagsInput: "",
    estimatedReadingMinutes: "",
    sourceUrl: "",
    bodyJson: emptyAuthoredContentDocument(),
    changeSummary: "",
  };

  return {
    ...defaults,
    ...seed,
    bodyJson: seed?.bodyJson ?? defaults.bodyJson,
  };
}

function buildFormFromDetail(detail: LearningResourceDetail): FormState {
  return {
    title: detail.title,
    description: detail.description ?? "",
    excerpt: detail.excerpt ?? "",
    contentType: detail.contentType,
    status: detail.status,
    visibility: detail.visibility,
    categoryName: detail.categoryName ?? "",
    subcategoryName: detail.subcategoryName ?? "",
    tagsInput: detail.tagNames.join(", "),
    estimatedReadingMinutes: detail.estimatedReadingMinutes ? String(detail.estimatedReadingMinutes) : "",
    sourceUrl: detail.storagePath ? "" : (detail.fileUrl ?? ""),
    bodyJson: detail.bodyJson ?? emptyAuthoredContentDocument(),
    changeSummary: "",
  };
}

function buildPrimaryAssetFromDetail(detail: LearningResourceDetail): LearningResourceAssetDraft | null {
  if (!detail.storagePath) {
    return null;
  }

  return {
    key: detail.storagePath,
    title: "",
    fileUrl: detail.fileUrl ?? "",
    fileName: detail.fileName ?? detail.title,
    fileSize: detail.fileSize,
    mimeType: detail.mimeType,
    storagePath: detail.storagePath ?? null,
    storageProvider: detail.storageProvider ?? null,
    uploadedAt: detail.updatedAt,
  };
}

function buildAcceptValue(config: LearningResourceUploadConfig | null) {
  if (!config) {
    return undefined;
  }

  const extensions = Array.from(
    new Set(
      [...config.allowedFileTypes, ...config.allowedImageTypes]
        .map((value) => value.trim().replace(/^[.]+/, "").toLowerCase())
        .filter(Boolean),
    ),
  );

  return extensions.length > 0 ? extensions.map((value) => `.${value}`).join(",") : undefined;
}

function isAbsoluteUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function uploadLearningResourceFiles(files: File[]): Promise<UploadedAsset[]> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/learning-resources/upload", {
    method: "POST",
    body: formData,
  });

  const payload = await parseApiResponse<{ assets: UploadedAsset[] }>(response, "Failed to upload files.");
  return payload.assets;
}

export function LearningResourceFormSheet({
  open,
  onOpenChange,
  resourceId,
  lookups = EMPTY_LEARNING_RESOURCE_LOOKUPS,
  onSaved,
  createPreset,
  categoryLocked = false,
  createTitle,
  createDescription,
}: LearningResourceFormSheetProps) {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(() => createInitialForm(createPreset));
  const [detail, setDetail] = useState<LearningResourceDetail | null>(null);
  const [primaryAsset, setPrimaryAsset] = useState<LearningResourceAssetDraft | null>(null);
  const [uploadConfig, setUploadConfig] = useState<LearningResourceUploadConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPrimary, setIsUploadingPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(resourceId);
  const isCreateCategoryLocked = categoryLocked && !isEditing;
  const isArticleContent = form.contentType === "ARTICLE";
  const isLinkContent = form.contentType === "LINK";
  const isLinkedContentResource = Boolean(detail?.sourceContentId);
  const acceptValue = useMemo(() => buildAcceptValue(uploadConfig), [uploadConfig]);
  const categoryOptions = useMemo(
    () => lookups.categories.filter((category) => category.parentId === null || !category.parentName),
    [lookups.categories],
  );
  const subcategoryOptions = useMemo(
    () => lookups.categories.filter((category) => Boolean(category.parentId)),
    [lookups.categories],
  );

  useEffect(() => {
    if (!open) {
      setForm(createInitialForm(createPreset));
      setDetail(null);
      setPrimaryAsset(null);
      setUploadConfig(null);
      setIsLoading(false);
      setIsSubmitting(false);
      setIsUploadingPrimary(false);
      setError(null);
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(Boolean(resourceId));
      setError(null);

      try {
        const detailRequest = resourceId
          ? fetch(`/api/learning-resources/${resourceId}`, { cache: "no-store" })
          : null;
        const configRequest = fetch("/api/learning-resources/upload", { cache: "no-store" });

        const [detailResponse, configResponse] = await Promise.all([
          detailRequest,
          configRequest,
        ]);

        const nextConfig = await parseApiResponse<LearningResourceUploadConfig>(
          configResponse,
          "Failed to load upload settings.",
        );

        if (!active) {
          return;
        }

        setUploadConfig(nextConfig);

        if (!detailResponse) {
          setForm(createInitialForm(createPreset));
          setDetail(null);
          setPrimaryAsset(null);
          return;
        }

        const nextDetail = await parseApiResponse<LearningResourceDetail>(
          detailResponse,
          "Failed to load resource details.",
        );

        if (!active) {
          return;
        }

        setDetail(nextDetail);
        setForm(buildFormFromDetail(nextDetail));
        setPrimaryAsset(buildPrimaryAssetFromDetail(nextDetail));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load resource details.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [createPreset, open, resourceId]);

  const handlePrimaryFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setIsUploadingPrimary(true);
    setError(null);

    try {
      if (files.length > 1) {
        toast.info("Only the first selected file was used as the primary asset.");
      }

      const [uploaded] = await uploadLearningResourceFiles([files[0]]);

      if (!uploaded) {
        throw new Error("Upload completed without returning a file asset.");
      }

      setPrimaryAsset(buildLearningResourceAssetDraftFromUpload(uploaded));
      setForm((current) => ({
        ...current,
        sourceUrl: "",
      }));
      toast.success("Primary asset uploaded.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload file.";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploadingPrimary(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = form.title.trim();
    const trimmedDescription = form.description.trim();
    const trimmedExcerpt = form.excerpt.trim();
    const trimmedSourceUrl = form.sourceUrl.trim();
    const parsedEstimatedReadingMinutes = form.estimatedReadingMinutes.trim()
      ? Number(form.estimatedReadingMinutes)
      : undefined;

    if (trimmedTitle.length < 2) {
      setError("Title must be at least 2 characters.");
      return;
    }

    if (isArticleContent && form.bodyJson.blocks.length === 0) {
      setError("Add at least one authored block before saving the article.");
      return;
    }

    if (typeof parsedEstimatedReadingMinutes === "number" && (!Number.isFinite(parsedEstimatedReadingMinutes) || parsedEstimatedReadingMinutes < 1)) {
      setError("Estimated reading time must be at least 1 minute.");
      return;
    }

    if (!isArticleContent && !primaryAsset && !trimmedSourceUrl) {
      setError(isLinkContent ? "Enter a destination URL for the link resource." : "Upload a primary asset or provide an external source URL.");
      return;
    }

    if (!isArticleContent && !primaryAsset && trimmedSourceUrl && !isAbsoluteUrl(trimmedSourceUrl)) {
      setError("Source URLs must include http:// or https://.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        title: trimmedTitle,
        description: trimmedDescription,
        excerpt: trimmedExcerpt,
        contentType: form.contentType,
        status: form.status,
        visibility: form.visibility,
        categoryName: form.categoryName.trim(),
        subcategoryName: form.subcategoryName.trim(),
        tags: parseTagInput(form.tagsInput),
        fileUrl: isArticleContent ? "" : (primaryAsset?.fileUrl ?? trimmedSourceUrl),
        fileName: isArticleContent ? "" : (primaryAsset?.fileName ?? ""),
        fileSize: isArticleContent ? undefined : (primaryAsset?.fileSize ?? undefined),
        mimeType: isArticleContent ? "" : (primaryAsset?.mimeType ?? ""),
        storagePath: isArticleContent ? "" : (primaryAsset?.storagePath ?? ""),
        storageProvider: isArticleContent ? undefined : (primaryAsset?.storageProvider ?? undefined),
        bodyJson: isArticleContent ? form.bodyJson : null,
        estimatedReadingMinutes: isArticleContent ? parsedEstimatedReadingMinutes : undefined,
        attachments: [],
        changeSummary: form.changeSummary.trim(),
      };

      const response = await fetch(resourceId ? `/api/learning-resources/${resourceId}` : "/api/learning-resources", {
        method: resourceId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      await parseApiResponse(response, resourceId ? "Failed to update learning resource." : "Failed to create learning resource.");

      toast.success(resourceId ? "Learning resource updated." : "Learning resource created.");
      onSaved();
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save learning resource.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[860px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Learning Resource" : (createTitle ?? "Create Learning Resource")}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? (isLinkedContentResource
                ? "Update repository metadata here. File, authored body, and folder changes continue through the repository explorer upload workflow."
                : "Manage reusable content, category metadata, access rules, and assignment-ready assets from a single workflow.")
              : (createDescription ?? "Manage reusable content, category metadata, access rules, and assignment-ready assets from a single workflow.")}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            ) : (
              <>
                {detail ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">Version {detail.currentVersionNumber}</Badge>
                    <Badge variant="default">{detail.assignmentCount} assignment{detail.assignmentCount === 1 ? "" : "s"}</Badge>
                    <Badge variant="accent">{detail.previewCount} preview{detail.previewCount === 1 ? "" : "s"}</Badge>
                  </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Resource Title</label>
                        <Input
                          value={form.title}
                          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                          placeholder="Pronunciation warm-up deck"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
                        <textarea
                          rows={4}
                          value={form.description}
                          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                          placeholder="Give admins and trainers enough context to understand where this resource fits."
                          className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Excerpt</label>
                        <textarea
                          rows={3}
                          value={form.excerpt}
                          onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
                          placeholder="Optional short summary used in previews and list cards."
                          className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Content Type</label>
                        <select
                          value={form.contentType}
                          onChange={(event) => setForm((current) => ({ ...current, contentType: event.target.value as LearningResourceContentType }))}
                          className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                          disabled={isLinkedContentResource}
                        >
                          {LEARNING_RESOURCE_CONTENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                        <select
                          value={form.status}
                          onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LearningResourceStatus }))}
                          className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                        >
                          {LEARNING_RESOURCE_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Visibility</label>
                        <select
                          value={form.visibility}
                          onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as LearningResourceVisibility }))}
                          className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                        >
                          {LEARNING_RESOURCE_VISIBILITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">Course delivery is controlled from Actions &gt; Manage Assignments.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                        <Input
                          list="learning-resource-category-options"
                          value={form.categoryName}
                          onChange={(event) => setForm((current) => ({ ...current, categoryName: event.target.value }))}
                          placeholder="Grammar, Clinical Skills, Orientation"
                          disabled={isCreateCategoryLocked || isLinkedContentResource}
                        />
                        <datalist id="learning-resource-category-options">
                          {categoryOptions.map((category) => (
                            <option key={category.id} value={category.name}>{getLearningResourceCategoryLabel(category)}</option>
                          ))}
                        </datalist>
                        {isCreateCategoryLocked ? (
                          <p className="text-xs text-slate-500">Direct uploads stay inside the locked repository branch.</p>
                        ) : isLinkedContentResource ? (
                          <p className="text-xs text-slate-500">Folder placement is managed from the repository explorer.</p>
                        ) : null}
                      </div>

                      {!isCreateCategoryLocked ? (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Subcategory</label>
                          <Input
                            list="learning-resource-subcategory-options"
                            value={form.subcategoryName}
                            onChange={(event) => setForm((current) => ({ ...current, subcategoryName: event.target.value }))}
                            placeholder="B1 Speaking, Bedside Handover"
                            disabled={isLinkedContentResource}
                          />
                          <datalist id="learning-resource-subcategory-options">
                            {subcategoryOptions.map((category) => (
                              <option key={category.id} value={category.name}>{getLearningResourceCategoryLabel(category)}</option>
                            ))}
                          </datalist>
                        </div>
                      ) : null}

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tags</label>
                        <Input
                          value={form.tagsInput}
                          onChange={(event) => setForm((current) => ({ ...current, tagsInput: event.target.value }))}
                          placeholder="pronunciation, warmup, trainer-led"
                        />
                        <p className="text-xs text-slate-500">Separate tags with commas. Existing tags appear in autocomplete lists after refresh.</p>
                      </div>

                      {isArticleContent ? (
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estimated Reading Minutes</label>
                          <Input
                            value={form.estimatedReadingMinutes}
                            onChange={(event) => setForm((current) => ({ ...current, estimatedReadingMinutes: event.target.value }))}
                            inputMode="numeric"
                            placeholder="8"
                            disabled={isLinkedContentResource}
                          />
                        </div>
                      ) : null}

                      {isArticleContent ? (
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Authored Content</label>
                          <AuthoredContentEditor
                            value={form.bodyJson}
                            onChange={(nextValue) => setForm((current) => ({ ...current, bodyJson: nextValue }))}
                            disabled={isSubmitting || isLinkedContentResource}
                          />
                        </div>
                      ) : (
                        <div className="space-y-4 sm:col-span-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Primary Asset</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Upload a file into the centralized library or point this resource to an external URL.
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => primaryInputRef.current?.click()}
                                  disabled={isSubmitting || isUploadingPrimary || isLinkedContentResource}
                                >
                                  {isUploadingPrimary ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                  Upload File
                                </Button>
                                <input
                                  ref={primaryInputRef}
                                  type="file"
                                  accept={acceptValue}
                                  className="hidden"
                                  onChange={handlePrimaryFileSelection}
                                />
                              </div>
                            </div>

                            {uploadConfig ? (
                              <p className="mt-3 text-xs text-slate-500">
                                Storage: {uploadConfig.storageLocation === "S3" ? "Amazon S3" : "Local public storage"} · Max file size {formatFileSize(uploadConfig.maximumFileUploadSizeBytes)}
                              </p>
                            ) : null}

                            {primaryAsset ? (
                              <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{primaryAsset.fileName}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {formatFileSize(primaryAsset.fileSize)}
                                    {primaryAsset.mimeType ? ` · ${primaryAsset.mimeType}` : ""}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setPrimaryAsset(null)}
                                >
                                  <X className="h-4 w-4" />
                                  <span className="sr-only">Remove primary asset</span>
                                </Button>
                              </div>
                            ) : null}

                            <div className="mt-4 space-y-1.5">
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                {isLinkContent ? "Destination URL" : "External Source URL"}
                              </label>
                              <Input
                                value={form.sourceUrl}
                                onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                                placeholder={isLinkContent ? "https://academy.example.com/warmup" : "Optional fallback to an external hosted file"}
                                disabled={isLinkedContentResource}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-sm font-semibold text-slate-900">Change Summary</p>
                      <p className="mt-1 text-xs text-slate-500">Captured in version history so reviewers can understand what changed.</p>
                      <div className="mt-3 space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Summary</label>
                        <textarea
                          rows={4}
                          value={form.changeSummary}
                          onChange={(event) => setForm((current) => ({ ...current, changeSummary: event.target.value }))}
                          placeholder="Updated category labels and replaced the PDF with a revised copy."
                          className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
              </>
            )}
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isLoading || isSubmitting || isUploadingPrimary}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Resource" : "Create Resource"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}