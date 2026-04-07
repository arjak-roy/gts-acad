"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, ImageIcon, Link2, Video } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type ContentDetail = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: string;
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  sortOrder: number;
  status: string;
  isScorm: boolean;
  scormMetadata: unknown;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  batchCount: number;
};

type UploadConfig = {
  enableDocumentPreview: boolean;
};

const contentTypeLabels: Record<string, string> = {
  ARTICLE: "Authored Lesson",
  PDF: "PDF",
  DOCUMENT: "Document",
  VIDEO: "Video",
  SCORM: "SCORM",
  LINK: "Link",
  OTHER: "Other",
};

const statusVariant: Record<string, "default" | "info" | "warning"> = {
  DRAFT: "info",
  PUBLISHED: "default",
  ARCHIVED: "warning",
};

function formatFileSize(bytes: number | null) {
  if (!bytes) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function PreviewBlock({ detail, previewEnabled }: { detail: ContentDetail; previewEnabled: boolean }) {
  if (detail.contentType === "ARTICLE") {
    return detail.renderedHtml ? (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div
          className="prose prose-slate max-w-none prose-headings:font-semibold prose-img:rounded-xl prose-li:marker:text-slate-500"
          dangerouslySetInnerHTML={{ __html: detail.renderedHtml }}
        />
      </div>
    ) : (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        No authored lesson content has been added yet.
      </div>
    );
  }

  if (!detail.fileUrl) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        No file or link is attached to this content item yet.
      </div>
    );
  }

  if (detail.contentType === "LINK") {
    return (
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Link2 className="h-4 w-4 text-primary" />
          External learning resource
        </div>
        <p className="mt-2 text-sm text-muted-foreground break-all">{detail.fileUrl}</p>
      </div>
    );
  }

  if (detail.mimeType?.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-xl border bg-slate-50 p-2">
        <img src={detail.fileUrl} alt={detail.title} className="max-h-[420px] w-full rounded-lg object-contain bg-white" />
      </div>
    );
  }

  if (detail.mimeType?.startsWith("video/")) {
    return (
      <div className="overflow-hidden rounded-xl border bg-black p-2">
        <video controls className="max-h-[420px] w-full rounded-lg" src={detail.fileUrl} />
      </div>
    );
  }

  const isPdf = detail.mimeType === "application/pdf" || detail.fileName?.toLowerCase().endsWith(".pdf");
  if (isPdf && previewEnabled) {
    return (
      <div className="overflow-hidden rounded-xl border bg-slate-50">
        <iframe title={`${detail.title} preview`} className="h-[520px] w-full bg-white" src={detail.fileUrl} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      {isPdf
        ? "Document preview is disabled in upload settings for this environment."
        : "Inline preview is not available for this content type. Use the open action to view the file."}
    </div>
  );
}

export function CourseContentDetailSheet({
  open,
  onOpenChange,
  contentId,
  refreshToken = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string | null;
  refreshToken?: number;
}) {
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !contentId) {
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setIsLoading(true);

      try {
        const [detailResponse, configResponse] = await Promise.all([
          fetch(`/api/course-content/${contentId}`, { cache: "no-store" }),
          fetch("/api/course-content/upload", { cache: "no-store" }),
        ]);

        const detailPayload = (await detailResponse.json()) as { data?: ContentDetail; error?: string };
        const configPayload = (await configResponse.json()) as { data?: UploadConfig; error?: string };

        if (!detailResponse.ok) {
          throw new Error(detailPayload.error || "Failed to load content detail.");
        }

        if (!cancelled) {
          setDetail(detailPayload.data ?? null);
          setPreviewEnabled(configResponse.ok ? Boolean(configPayload.data?.enableDocumentPreview) : true);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load content detail.");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [contentId, onOpenChange, open, refreshToken]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.title ?? "Content details"}</SheetTitle>
          <SheetDescription>
            Review course content metadata and open the uploaded file or external resource.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-1 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          ) : detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[detail.status] ?? "info"}>{detail.status}</Badge>
                <Badge variant="info">{contentTypeLabels[detail.contentType] ?? detail.contentType}</Badge>
                {detail.isScorm ? <Badge variant="accent">SCORM Coming Soon</Badge> : null}
                <Badge variant="default">{detail.courseName}</Badge>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{detail.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.contentType === "ARTICLE"
                        ? `${detail.estimatedReadingMinutes ? `${detail.estimatedReadingMinutes} min read` : "Authored lesson"}${detail.excerpt ? " · Ready for learner rendering" : ""}`
                        : `${detail.fileName ?? "No file name"} · ${formatFileSize(detail.fileSize)}`}
                    </p>
                  </div>
                  {detail.fileUrl && detail.contentType !== "ARTICLE" ? (
                    <Button asChild size="sm" variant="secondary">
                      <a href={detail.fileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open content
                      </a>
                    </Button>
                  ) : null}
                </div>
                {detail.description ? (
                  <p className="mt-3 text-sm text-slate-700">{detail.description}</p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No description provided.</p>
                )}
                {detail.excerpt ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Excerpt</p>
                    <p className="mt-1 text-sm text-slate-700">{detail.excerpt}</p>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Created By</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.createdByName ?? "System"}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Assigned Batches</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.batchCount}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Reading Time</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {detail.estimatedReadingMinutes ? `${detail.estimatedReadingMinutes} min` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Created</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(detail.createdAt)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Updated</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(detail.updatedAt)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {detail.mimeType?.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-primary" />
                  ) : detail.mimeType?.startsWith("video/") ? (
                    <Video className="h-4 w-4 text-primary" />
                  ) : detail.contentType === "ARTICLE" ? (
                    <FileText className="h-4 w-4 text-primary" />
                  ) : detail.contentType === "LINK" ? (
                    <Link2 className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                  <p className="text-sm font-semibold">Preview</p>
                </div>
                <PreviewBlock detail={detail} previewEnabled={previewEnabled} />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No content selected.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}