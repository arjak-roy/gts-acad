"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, ImageIcon, Link2, Video } from "lucide-react";
import { toast } from "sonner";

import {
  buildLearningResourceAssetUrl,
  formatDateTime,
  formatFileSize,
  getLearningResourceStatusBadgeVariant,
  getLearningResourceVisibilityBadgeVariant,
  LEARNING_RESOURCE_CONTENT_TYPE_LABELS,
  LEARNING_RESOURCE_TARGET_TYPE_LABELS,
  LEARNING_RESOURCE_VISIBILITY_LABELS,
  parseApiResponse,
  type LearningResourceDetail,
} from "@/components/modules/course-builder/learning-resource-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type LearningResourceDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string | null;
  refreshToken?: number;
};

function PreviewBlock({ detail }: { detail: LearningResourceDetail }) {
  const primaryAssetUrl = buildLearningResourceAssetUrl(detail.id);

  if (detail.contentType === "ARTICLE") {
    return detail.renderedHtml ? (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div
          className="prose prose-slate max-w-none prose-headings:font-semibold prose-img:rounded-xl prose-li:marker:text-slate-500"
          dangerouslySetInnerHTML={{ __html: detail.renderedHtml }}
        />
      </div>
    ) : (
      <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
        This article does not have rendered content yet.
      </div>
    );
  }

  if (!detail.fileUrl && !detail.storagePath) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
        No primary asset is attached to this resource.
      </div>
    );
  }

  if (detail.contentType === "LINK") {
    return (
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Link2 className="h-4 w-4 text-primary" />
          External resource
        </div>
        <p className="mt-2 break-all text-sm text-slate-600">{detail.fileUrl}</p>
        <div className="mt-4">
          <Button asChild size="sm" variant="secondary">
            <a href={primaryAssetUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Link
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (detail.mimeType?.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-xl border bg-slate-50 p-2">
        <div className="relative h-[420px] w-full overflow-hidden rounded-lg bg-white">
          <Image
            src={primaryAssetUrl}
            alt={detail.title}
            fill
            unoptimized
            loader={({ src }) => src}
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-contain"
          />
        </div>
      </div>
    );
  }

  if (detail.mimeType?.startsWith("video/")) {
    return (
      <div className="overflow-hidden rounded-xl border bg-black p-2">
        <video controls className="max-h-[420px] w-full rounded-lg" src={primaryAssetUrl} />
      </div>
    );
  }

  const isPdf = detail.mimeType === "application/pdf" || detail.fileName?.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return (
      <div className="overflow-hidden rounded-xl border bg-slate-50">
        <iframe title={`${detail.title} preview`} className="h-[520px] w-full bg-white" src={primaryAssetUrl} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
      Inline preview is not available for this file type. Use the open or download actions instead.
    </div>
  );
}

export function LearningResourceDetailSheet({
  open,
  onOpenChange,
  resourceId,
  refreshToken = 0,
}: LearningResourceDetailSheetProps) {
  const [detail, setDetail] = useState<LearningResourceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resourceId) {
      return;
    }

    let active = true;

    const loadDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/learning-resources/${resourceId}`, { cache: "no-store" });
        const payload = await parseApiResponse<LearningResourceDetail>(response, "Failed to load learning resource details.");

        if (!active) {
          return;
        }

        setDetail(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load learning resource details.";
        setError(message);
        toast.error(message);
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
  }, [open, refreshToken, resourceId]);

  const primaryAssetUrl = useMemo(() => (detail ? buildLearningResourceAssetUrl(detail.id) : null), [detail]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[760px]">
        <SheetHeader>
          <SheetTitle>{detail?.title ?? "Learning Resource Details"}</SheetTitle>
          <SheetDescription>
            Review repository metadata, preview the primary asset, and inspect assignment coverage.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-1 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getLearningResourceStatusBadgeVariant(detail.status)}>{detail.status}</Badge>
                <Badge variant={getLearningResourceVisibilityBadgeVariant(detail.visibility)}>{LEARNING_RESOURCE_VISIBILITY_LABELS[detail.visibility]}</Badge>
                <Badge variant="info">{LEARNING_RESOURCE_CONTENT_TYPE_LABELS[detail.contentType]}</Badge>
                {detail.categoryName ? <Badge variant="default">{detail.categoryName}</Badge> : null}
                {detail.subcategoryName ? <Badge variant="accent">{detail.subcategoryName}</Badge> : null}
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{detail.title}</p>
                    <p className="text-xs text-slate-500">
                      {detail.fileName ? `${detail.fileName} · ${formatFileSize(detail.fileSize)}` : "Primary asset stored in the resource library"}
                    </p>
                  </div>
                  {primaryAssetUrl ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a href={primaryAssetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open Asset
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <a href={buildLearningResourceAssetUrl(detail.id, { download: true })}>
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>

                {detail.description ? <p className="mt-3 text-sm text-slate-700">{detail.description}</p> : null}

                {detail.excerpt ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Excerpt</p>
                    <p className="mt-1 text-sm text-slate-700">{detail.excerpt}</p>
                  </div>
                ) : null}

                {detail.tagNames.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.tagNames.map((tagName) => (
                      <Badge key={tagName} variant="default">{tagName}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Assignments</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.assignmentCount}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Versions</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.versionsCount}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Previews</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.previewCount}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Downloads</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.downloadCount}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Created By</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.createdByName ?? "System"}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Updated By</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{detail.updatedByName ?? detail.createdByName ?? "System"}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Created</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(detail.createdAt)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Updated</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(detail.updatedAt)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {detail.mimeType?.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-primary" />
                  ) : detail.mimeType?.startsWith("video/") ? (
                    <Video className="h-4 w-4 text-primary" />
                  ) : detail.contentType === "LINK" ? (
                    <Link2 className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                  <p className="text-sm font-semibold text-slate-900">Preview</p>
                </div>
                <PreviewBlock detail={detail} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assignments</p>
                  {detail.assignments.length > 0 ? (
                    <div className="space-y-3">
                      {detail.assignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{assignment.targetLabel}</p>
                            <Badge variant="info">{LEARNING_RESOURCE_TARGET_TYPE_LABELS[assignment.targetType]}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {assignment.assignedByName ? `${assignment.assignedByName} · ` : ""}{formatDateTime(assignment.assignedAt)}
                          </p>
                          {assignment.notes ? <p className="mt-2 text-sm text-slate-600">{assignment.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">This resource has not been assigned yet.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Repository Link</p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {detail.sourceContentId ? "Linked to repository upload" : "Standalone repository record"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {detail.sourceContentId
                        ? "Folder placement, file replacement, and authored content edits are driven from the repository explorer."
                        : "This record is not linked to a repository upload item."}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">No resource selected.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}