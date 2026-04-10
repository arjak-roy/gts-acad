"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatDateTime,
  formatFileSize,
  getLearningResourceStatusBadgeVariant,
  getLearningResourceVisibilityBadgeVariant,
  LEARNING_RESOURCE_CONTENT_TYPE_LABELS,
  LEARNING_RESOURCE_VISIBILITY_LABELS,
  parseApiResponse,
  type LearningResourceVersionDetail,
} from "@/components/modules/course-builder/learning-resource-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type LearningResourceHistorySheetProps = {
  resourceId: string | null;
  resourceTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshToken?: number;
  onRestored: () => void;
};

export function LearningResourceHistorySheet({
  resourceId,
  resourceTitle,
  open,
  onOpenChange,
  refreshToken = 0,
  onRestored,
}: LearningResourceHistorySheetProps) {
  const [versions, setVersions] = useState<LearningResourceVersionDetail[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resourceId) {
      return;
    }

    let active = true;

    const loadVersions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/learning-resources/${resourceId}/history`, { cache: "no-store" });
        const payload = await parseApiResponse<LearningResourceVersionDetail[]>(response, "Failed to load resource history.");

        if (!active) {
          return;
        }

        setVersions(payload);
        setSelectedVersionId((current) => current && payload.some((version) => version.id === current) ? current : (payload[0]?.id ?? null));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load resource history.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadVersions();

    return () => {
      active = false;
    };
  }, [open, refreshToken, resourceId]);

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;

  const handleRestore = async () => {
    if (!resourceId || !selectedVersion) {
      return;
    }

    const confirmed = window.confirm(`Restore ${resourceTitle ?? "this resource"} from version ${selectedVersion.versionNumber}?`);
    if (!confirmed) {
      return;
    }

    setIsRestoring(true);

    try {
      const response = await fetch(`/api/learning-resources/${resourceId}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          versionId: selectedVersion.id,
          changeSummary: `Restored from version ${selectedVersion.versionNumber}`,
        }),
      });

      await parseApiResponse(response, "Failed to restore learning resource version.");
      toast.success(`Version ${selectedVersion.versionNumber} restored.`);
      onRestored();
    } catch (restoreError) {
      const message = restoreError instanceof Error ? restoreError.message : "Failed to restore version.";
      toast.error(message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[980px]">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            {resourceTitle ?? "Learning resource"} · {versions.length} recorded version{versions.length === 1 ? "" : "s"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <p className="text-sm text-slate-500">No version history has been recorded yet.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-6 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Recorded Versions</p>
              <div className="mt-4 space-y-2">
                {versions.map((version) => {
                  const isActive = version.id === selectedVersion?.id;
                  return (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => setSelectedVersionId(version.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${isActive ? "border-primary/30 bg-white text-slate-900 shadow-sm" : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">Version {version.versionNumber}</span>
                        <span className="text-xs text-slate-500">{formatDateTime(version.createdAt)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{version.title}</p>
                      {version.changeSummary ? <p className="mt-2 line-clamp-2 text-xs text-slate-600">{version.changeSummary}</p> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto space-y-4">
              {selectedVersion ? (
                <>
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">Version {selectedVersion.versionNumber}</Badge>
                      <Badge variant={getLearningResourceStatusBadgeVariant(selectedVersion.snapshot.status)}>{selectedVersion.snapshot.status}</Badge>
                      <Badge variant={getLearningResourceVisibilityBadgeVariant(selectedVersion.snapshot.visibility)}>
                        {LEARNING_RESOURCE_VISIBILITY_LABELS[selectedVersion.snapshot.visibility]}
                      </Badge>
                      <Badge variant="accent">{LEARNING_RESOURCE_CONTENT_TYPE_LABELS[selectedVersion.snapshot.contentType]}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Captured</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(selectedVersion.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Updated By</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedVersion.updatedByName ?? "System"}</p>
                      </div>
                    </div>

                    {selectedVersion.changeSummary ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Change Summary</p>
                        <p className="mt-2 text-sm text-slate-700">{selectedVersion.changeSummary}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Snapshot</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{selectedVersion.snapshot.title}</h3>
                    {selectedVersion.snapshot.description ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedVersion.snapshot.description}</p>
                    ) : null}

                    {selectedVersion.snapshot.categoryName || selectedVersion.snapshot.subcategoryName || selectedVersion.snapshot.tags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedVersion.snapshot.categoryName ? <Badge variant="default">{selectedVersion.snapshot.categoryName}</Badge> : null}
                        {selectedVersion.snapshot.subcategoryName ? <Badge variant="accent">{selectedVersion.snapshot.subcategoryName}</Badge> : null}
                        {selectedVersion.snapshot.tags.map((tag) => (
                          <Badge key={tag} variant="info">{tag}</Badge>
                        ))}
                      </div>
                    ) : null}

                    {selectedVersion.snapshot.renderedHtml ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
                        <div
                          className="prose prose-slate max-w-none prose-headings:font-semibold prose-img:rounded-xl prose-li:marker:text-slate-500"
                          dangerouslySetInnerHTML={{ __html: selectedVersion.snapshot.renderedHtml }}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        <p>
                          Primary file: {selectedVersion.snapshot.fileName || selectedVersion.snapshot.fileUrl || "No primary file recorded"}
                          {selectedVersion.snapshot.fileSize ? ` · ${formatFileSize(selectedVersion.snapshot.fileSize)}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          <CanAccess permission="learning_resources.edit">
            <Button type="button" onClick={handleRestore} disabled={!selectedVersion || isRestoring}>
              {isRestoring ? "Restoring..." : "Restore Version"}
            </Button>
          </CanAccess>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}