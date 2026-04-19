"use client";

import { useCallback, useState } from "react";
import { FileText, FolderOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RichContentEditorSheet } from "@/components/modules/course-builder/rich-content-editor-sheet";

type FolderOption = {
  id: string;
  name: string;
  contentCount: number;
};

type Step = "setup" | "editing" | "saving";

type CurriculumInlineContentCreatorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  folders: FolderOption[];
  stageId: string;
  onComplete: (contentId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
};

export function CurriculumInlineContentCreator({
  open,
  onOpenChange,
  courseId,
  folders,
  onComplete,
  onRefresh,
  disabled,
}: CurriculumInlineContentCreatorProps) {
  const [step, setStep] = useState<Step>("setup");
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [contentId, setContentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("setup");
    setTitle("");
    setFolderId("");
    setContentId(null);
    setIsCreating(false);
    setIsSaving(false);
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        // If we already created content, refresh the reference list so it shows up
        if (contentId) {
          void onRefresh();
        }
        reset();
      }
      onOpenChange(next);
    },
    [contentId, onOpenChange, onRefresh, reset],
  );

  // Step 1: Create empty content in resource repository
  const handleCreateContent = useCallback(async () => {
    const trimmed = title.trim();
    if (trimmed.length < 2) {
      setError("Title must be at least 2 characters.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/course-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: trimmed,
          folderId: folderId || null,
          contentType: "ARTICLE",
          description: "",
          bodyJson: { version: 2, html: "<p></p>" },
          status: "DRAFT",
          isScorm: false,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        data?: { id: string };
        error?: string;
      } | null;

      if (!res.ok || !json?.data?.id) {
        setError(json?.error ?? "Failed to create content. Please try again.");
        return;
      }

      setContentId(json.data.id);
      setStep("editing");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }, [courseId, folderId, title]);

  // Step 2: Save editor HTML → update content → add as stage item
  const handleEditorSave = useCallback(
    async (html: string) => {
      if (!contentId) return;

      setStep("saving");
      setIsSaving(true);

      try {
        // Update the content body in the resource repository
        const patchRes = await fetch(`/api/course-content/${contentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bodyJson: { version: 2, html },
          }),
        });

        if (!patchRes.ok) {
          setError("Failed to save content. Please try again.");
          setStep("editing");
          setIsSaving(false);
          return;
        }

        // Add as stage item
        const ok = await onComplete(contentId);

        if (ok) {
          handleOpenChange(false);
        } else {
          setError("Content saved but failed to add as stage item. You can add it manually from the content picker.");
          setStep("editing");
        }
      } catch {
        setError("Network error while saving. Please try again.");
        setStep("editing");
      } finally {
        setIsSaving(false);
      }
    },
    [contentId, handleOpenChange, onComplete],
  );

  // Render step 1: Setup dialog
  if (step === "setup") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#0d3b84]" />
              Create Authored Content
            </DialogTitle>
            <DialogDescription>
              This will create a new article in the resource repository and open the rich editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="inline-content-title" className="text-sm font-medium text-slate-700">Title</label>
              <Input
                id="inline-content-title"
                placeholder="e.g. Introduction to JavaScript"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    void handleCreateContent();
                  }
                }}
                disabled={isCreating}
                autoFocus
              />
            </div>

            {folders.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="inline-content-folder" className="flex items-center text-sm font-medium text-slate-700">
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />
                  Folder (optional)
                </label>
                <select
                  id="inline-content-folder"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  disabled={isCreating}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateContent()} disabled={isCreating || disabled}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create & Open Editor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2/3: Rich editor (or saving state)
  return (
    <>
      {error && step === "editing" && (
        <Dialog open onOpenChange={() => setError(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Error</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-red-600">{error}</p>
            <DialogFooter>
              <Button onClick={() => setError(null)}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <RichContentEditorSheet
        open={step === "editing" || step === "saving"}
        onOpenChange={(next) => {
          if (!next && !isSaving) {
            handleOpenChange(false);
          }
        }}
        initialHtml="<p></p>"
        onSave={(html, plainText) => void handleEditorSave(html, plainText)}
        courseId={courseId}
        disabled={isSaving || disabled}
      />
    </>
  );
}
