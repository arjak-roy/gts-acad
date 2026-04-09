"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type VersionSummary = {
  id: string;
  versionNumber: number;
  subject: string;
  updatedByName: string | null;
  createdAt: string;
};

type VersionDetail = VersionSummary & {
  htmlContent: string;
  textContent: string | null;
};

type TemplateHistorySheetProps = {
  templateId: string | null;
  templateName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TemplateHistorySheet({ templateId, templateName, open, onOpenChange }: TemplateHistorySheetProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !templateId) return;

    let active = true;
    setIsLoading(true);
    setError(null);
    setSelectedVersion(null);

    fetch(`/api/email-templates/${templateId}/history`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load version history.");
        const payload = (await res.json()) as { data?: VersionSummary[] };
        if (active) setVersions(payload.data ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load version history.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [open, templateId]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setVersions([]);
      setSelectedVersion(null);
      setError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>{templateName ?? "Email Template"} — {versions.length} version{versions.length !== 1 ? "s" : ""} recorded</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : selectedVersion ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Button variant="secondary" size="sm" onClick={() => setSelectedVersion(null)}>Back to versions</Button>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Version {selectedVersion.versionNumber}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(selectedVersion.createdAt).toLocaleString("en-IN")}
                {selectedVersion.updatedByName ? ` by ${selectedVersion.updatedByName}` : ""}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Subject</p>
              <p className="text-sm text-slate-700">{selectedVersion.subject}</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <p className="border-b border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">HTML Body</p>
              <iframe title="Version HTML preview" className="h-72 w-full bg-white" srcDoc={selectedVersion.htmlContent} />
            </div>

            {selectedVersion.textContent ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Plain Text</p>
                <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">{selectedVersion.textContent}</pre>
              </div>
            ) : null}
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">No version history recorded yet. History is created when templates are edited.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-2">
              {versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelectedVersion({ ...version, htmlContent: "", textContent: null })}
                  onClickCapture={async () => {
                    try {
                      const res = await fetch(`/api/email-templates/${templateId}/history`, { cache: "no-store" });
                      const payload = (await res.json()) as { data?: VersionDetail[] };
                      const match = payload.data?.find((v: VersionDetail) => v.id === version.id);
                      if (match) setSelectedVersion(match);
                    } catch {
                      // Version details not available separately — show summary
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Version {version.versionNumber}</span>
                    <span className="text-xs text-slate-500">{new Date(version.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 truncate">{version.subject}</p>
                  {version.updatedByName ? (
                    <p className="mt-1 text-xs text-slate-400">by {version.updatedByName}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        <SheetFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
