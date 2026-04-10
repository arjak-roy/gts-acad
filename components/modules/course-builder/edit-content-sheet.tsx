"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { type AuthoredContentDocument, emptyAuthoredContentDocument } from "@/lib/authored-content";
import { AuthoredContentEditor } from "@/components/modules/course-builder/authored-content-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type FolderOption = {
  id: string;
  name: string;
  description: string | null;
};

type ContentDetail = {
  id: string;
  courseId: string;
  courseName: string;
  folderId: string | null;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: string;
  bodyJson: AuthoredContentDocument | null;
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: string | null;
  sortOrder: number;
  status: string;
  isScorm: boolean;
  isAiGenerated: boolean;
  aiGenerationMetadata: unknown;
  createdAt: string;
  updatedAt: string;
};

type EditContentForm = {
  title: string;
  description: string;
  folderId: string;
  contentType: string;
  bodyJson: AuthoredContentDocument;
  estimatedReadingMinutes: string;
  fileUrl: string;
  status: string;
  sortOrder: string;
};

const statusOptions = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const contentTypeLabels: Record<string, string> = {
  ARTICLE: "Authored Lesson",
  PDF: "PDF",
  DOCUMENT: "Document",
  VIDEO: "Video",
  LINK: "Link",
  SCORM: "SCORM",
  OTHER: "Other",
};

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function buildForm(detail: ContentDetail): EditContentForm {
  return {
    title: detail.title,
    description: detail.description ?? "",
    folderId: detail.folderId ?? "",
    contentType: detail.contentType,
    bodyJson: detail.bodyJson ?? emptyAuthoredContentDocument(),
    estimatedReadingMinutes: detail.estimatedReadingMinutes ? String(detail.estimatedReadingMinutes) : "",
    fileUrl: detail.fileUrl ?? "",
    status: detail.status,
    sortOrder: String(detail.sortOrder),
  };
}

export function EditContentSheet({
  contentId,
  open,
  onOpenChange,
  folders,
  onUpdated,
}: {
  contentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderOption[];
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [form, setForm] = useState<EditContentForm | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !contentId) {
      setDetail(null);
      setForm(null);
      setError(null);
      return;
    }

    let active = true;

    const loadDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/course-content/${contentId}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { data?: ContentDetail; error?: string } | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error || "Failed to load content details.");
        }

        if (!active) {
          return;
        }

        setDetail(payload.data);
        setForm(buildForm(payload.data));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load content details.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [contentId, open]);

  const isStoredUpload = Boolean(detail?.storagePath);
  const isArticleContent = form?.contentType === "ARTICLE";

  const availableContentTypes = useMemo(() => {
    const baseOptions = ["ARTICLE", "PDF", "DOCUMENT", "VIDEO", "LINK", "OTHER"];
    if (!isStoredUpload) {
      return baseOptions;
    }

    return baseOptions.filter((option) => option !== "LINK" && option !== "ARTICLE");
  }, [isStoredUpload]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!contentId || !form) {
      return;
    }

    const trimmedTitle = form.title.trim();
    const trimmedDescription = form.description.trim();
    const trimmedFileUrl = form.fileUrl.trim();
    const parsedSortOrder = Number(form.sortOrder);
    const parsedEstimatedMinutes = form.estimatedReadingMinutes.trim().length > 0 ? Number(form.estimatedReadingMinutes) : undefined;

    if (trimmedTitle.length < 2) {
      setError("Title must be at least 2 characters.");
      return;
    }

    if (trimmedDescription.length > 2000) {
      setError("Description cannot exceed 2000 characters.");
      return;
    }

    if (!Number.isFinite(parsedSortOrder) || parsedSortOrder < 0) {
      setError("Sort order must be 0 or greater.");
      return;
    }

    if (form.contentType === "ARTICLE" && form.bodyJson.blocks.length === 0) {
      setError("Add at least one authored lesson block.");
      return;
    }

    if (parsedEstimatedMinutes !== undefined && (!Number.isFinite(parsedEstimatedMinutes) || parsedEstimatedMinutes < 1)) {
      setError("Reading time must be at least 1 minute.");
      return;
    }

    if (!isStoredUpload && form.contentType !== "ARTICLE") {
      if (!trimmedFileUrl) {
        setError("External content requires a source URL.");
        return;
      }

      if (!isValidUrl(trimmedFileUrl)) {
        setError("Enter a valid URL including http:// or https://.");
        return;
      }
    }

    if (!isStoredUpload && form.contentType === "LINK") {
      if (!trimmedFileUrl) {
        setError("Link content requires a destination URL.");
        return;
      }

      if (!isValidUrl(trimmedFileUrl)) {
        setError("Enter a valid URL including http:// or https://.");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/course-content/${contentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          folderId: form.folderId || null,
          contentType: form.contentType,
          ...(form.contentType === "ARTICLE"
            ? {
              bodyJson: form.bodyJson,
              estimatedReadingMinutes: parsedEstimatedMinutes,
            }
            : isStoredUpload
              ? {}
              : { fileUrl: trimmedFileUrl }),
          status: form.status,
          sortOrder: parsedSortOrder,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update content.");
      }

      toast.success("Content metadata updated.");
      onUpdated();
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to update content.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit Content Metadata</SheetTitle>
          <SheetDescription>
            Update the discoverability and delivery metadata without replacing the underlying asset.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-1 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          ) : detail && form ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{detail.courseName}</Badge>
                <Badge variant="info">{contentTypeLabels[detail.contentType] ?? detail.contentType}</Badge>
                <Badge variant="info">{detail.status}</Badge>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Content Snapshot</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Source</p>
                    <p className="mt-1 text-sm text-slate-900">{detail.contentType === "ARTICLE" ? "Native authored lesson" : detail.fileName ?? "External resource"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reading time</p>
                    <p className="mt-1 text-sm text-slate-900">{detail.estimatedReadingMinutes ? `${detail.estimatedReadingMinutes} min` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mime type</p>
                    <p className="mt-1 text-sm text-slate-900">{detail.mimeType ?? (detail.contentType === "ARTICLE" ? "text/html (rendered)" : "-")}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Storage</p>
                    <p className="mt-1 text-sm text-slate-900">{detail.contentType === "ARTICLE" ? "Database-authored" : detail.storageProvider ?? "External URL"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => current ? { ...current, title: event.target.value } : current)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((current) => current ? { ...current, description: event.target.value } : current)}
                  className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                  placeholder="Add learner-facing context, trainer notes, or search-friendly description text."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Folder</label>
                  <select
                    value={form.folderId}
                    onChange={(event) => setForm((current) => current ? { ...current, folderId: event.target.value } : current)}
                    className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                  >
                    <option value="">Library root</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => current ? { ...current, status: event.target.value } : current)}
                    className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content Type</label>
                  <select
                    value={form.contentType}
                    onChange={(event) => setForm((current) => current ? {
                      ...current,
                      contentType: event.target.value,
                      bodyJson: event.target.value === "ARTICLE" ? current.bodyJson ?? emptyAuthoredContentDocument() : current.bodyJson,
                    } : current)}
                    className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                  >
                    {availableContentTypes.map((contentType) => (
                      <option key={contentType} value={contentType}>{contentTypeLabels[contentType] ?? contentType}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort Order</label>
                  <Input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(event) => setForm((current) => current ? { ...current, sortOrder: event.target.value } : current)}
                  />
                </div>
              </div>

              {isArticleContent && form ? (
                <div className="space-y-4">
                  <div className="space-y-2 sm:max-w-[220px]">
                    <label className="text-sm font-medium">Reading time (minutes)</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Optional"
                      value={form.estimatedReadingMinutes}
                      onChange={(event) => setForm((current) => current ? { ...current, estimatedReadingMinutes: event.target.value } : current)}
                    />
                  </div>

                  <AuthoredContentEditor
                    value={form.bodyJson}
                    onChange={(nextBodyJson) => setForm((current) => current ? { ...current, bodyJson: nextBodyJson } : current)}
                    disabled={isSubmitting}
                  />
                </div>
              ) : null}

              {!isStoredUpload && !isArticleContent ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source URL</label>
                  <Input
                    type="url"
                    placeholder="https://example.com/resource"
                    value={form.fileUrl}
                    onChange={(event) => setForm((current) => current ? { ...current, fileUrl: event.target.value } : current)}
                  />
                  <p className="text-xs text-slate-500">
                    External resources keep their URL editable. Uploaded assets stay storage-backed and cannot change source here.
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Select a content item to edit.
            </div>
          )}

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isSubmitting || !detail || !form}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}