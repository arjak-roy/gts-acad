"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { LearningResourceFolderSummary } from "@/components/modules/course-builder/learning-resource-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type EditableFolder = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
};

type FolderForm = {
  parentId: string;
  name: string;
  description: string;
  sortOrder: string;
};

const initialForm: FolderForm = {
  parentId: "",
  name: "",
  description: "",
  sortOrder: "0",
};

function collectDescendantFolderIds(folders: LearningResourceFolderSummary[], folderId: string) {
  const descendants = new Set<string>();
  const queue = folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id);

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || descendants.has(currentId)) {
      continue;
    }

    descendants.add(currentId);

    for (const child of folders) {
      if (child.parentId === currentId) {
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

export function LearningResourceFolderSheet({
  open,
  onOpenChange,
  folder,
  folders,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: EditableFolder | null;
  folders: LearningResourceFolderSummary[];
  onSaved: (folderId: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState<FolderForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(folder?.id);

  const descendantIds = useMemo(
    () => (folder?.id ? collectDescendantFolderIds(folders, folder.id) : new Set<string>()),
    [folder?.id, folders],
  );
  const availableParentFolders = useMemo(
    () => folders.filter((entry) => entry.id !== folder?.id && !descendantIds.has(entry.id)),
    [descendantIds, folder?.id, folders],
  );

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      return;
    }

    if (!folder) {
      setForm(initialForm);
      return;
    }

    setForm({
      parentId: folder.parentId ?? "",
      name: folder.name,
      description: folder.description ?? "",
      sortOrder: String(folder.sortOrder),
    });
  }, [folder, open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        isEditing && folder ? `/api/learning-resources/folders/${folder.id}` : "/api/learning-resources/folders",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: form.parentId || null,
            name: form.name,
            description: form.description,
            sortOrder: Number(form.sortOrder || "0"),
          }),
        },
      );

      const payload = (await response.json()) as { data?: { id: string }; error?: string };

      if (!response.ok || !payload.data?.id) {
        throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} repository folder.`);
      }

      toast.success(isEditing ? "Repository folder updated." : "Repository folder created.");
      await onSaved(payload.data.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} repository folder.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Repository Folder" : "New Repository Folder"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Rename the folder, move it within the repository tree, or update its notes so reusable content stays discoverable."
              : "Create a global repository folder that can organize reusable content across courses, curricula, and batches."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-1 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Parent Folder</label>
            <select
              value={form.parentId}
              onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
              className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Repository root</option>
              {availableParentFolders.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.pathLabel}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Folder Name</label>
            <Input
              placeholder="e.g., Onboarding / Week 1"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional notes about what belongs in this repository folder."
              rows={4}
              className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
            />
          </div>

          <div className="space-y-2 sm:max-w-[180px]">
            <label className="text-sm font-medium">Sort Order</label>
            <Input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Folder")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}