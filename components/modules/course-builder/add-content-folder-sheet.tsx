"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type FolderResponse = {
  data?: {
    id: string;
  };
  error?: string;
};

type EditableFolder = {
  id: string;
  name: string;
  description: string | null;
};

type FolderForm = {
  name: string;
  description: string;
};

const initialForm: FolderForm = {
  name: "",
  description: "",
};

export function AddContentFolderSheet({
  open,
  onOpenChange,
  courseId,
  folder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  folder?: EditableFolder | null;
  onSaved: (folderId: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState<FolderForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(folder?.id);

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      return;
    }

    if (folder) {
      setForm({
        name: folder.name,
        description: folder.description ?? "",
      });
      return;
    }

    setForm(initialForm);
  }, [folder, open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(isEditing && folder ? `/api/course-content-folders/${folder.id}` : "/api/course-content-folders", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? {} : { courseId }),
          name: form.name,
          description: form.description,
        }),
      });

      const payload = (await response.json()) as FolderResponse;

      if (!response.ok || !payload.data?.id) {
        throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} folder.`);
      }

      toast.success(isEditing ? "Folder updated." : "Folder created.");
      await onSaved(payload.data.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} folder.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Rename Folder" : "New Folder"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the folder name and notes so the explorer stays clear and searchable."
              : "Create a folder in the content explorer so uploads can be routed with consistent library structure."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-1 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Folder Name</label>
            <Input
              placeholder="e.g., Module 1 Readings"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional notes about what this folder is for."
              rows={4}
              className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
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