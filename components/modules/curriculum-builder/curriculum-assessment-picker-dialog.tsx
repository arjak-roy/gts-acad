"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import { CurriculumReferencePickerDialog } from "@/components/modules/curriculum-builder/curriculum-reference-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import { cn } from "@/lib/utils";

type AssessmentOption = {
  id: string;
  code: string;
  title: string;
  status: string;
  questionType: string;
  difficultyLevel: string;
  isLinkedToCourse: boolean;
};

type CurriculumAssessmentPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AssessmentOption[];
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (input: { assessmentPoolIds: string[]; isRequired: boolean }) => Promise<boolean>;
};

export function CurriculumAssessmentPickerDialog({
  open,
  onOpenChange,
  items,
  isLoading,
  isSaving,
  onSubmit,
}: CurriculumAssessmentPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [confirmAutoLinkOpen, setConfirmAutoLinkOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedIds([]);
      setIsRequired(false);
      setConfirmAutoLinkOpen(false);
    }
  }, [open]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleItems = useMemo(() => items.filter((item) => {
    if (!normalizedSearch) {
      return true;
    }

    return [item.title, item.code, item.questionType, item.difficultyLevel, item.status]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  }), [items, normalizedSearch]);

  const selectedUnlinkedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id) && !item.isLinkedToCourse),
    [items, selectedIds],
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ));
  };

  const handleSubmit = async () => {
    const ok = await onSubmit({
      assessmentPoolIds: selectedIds,
      isRequired,
    });

    if (ok) {
      setConfirmAutoLinkOpen(false);
      onOpenChange(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedUnlinkedItems.length > 0) {
      setConfirmAutoLinkOpen(true);
      return;
    }

    await handleSubmit();
  };

  return (
    <>
      <CurriculumReferencePickerDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Add Assessments to Stage"
        description="Search across the full assessment pool and add one or more assessments to this stage. Each selected assessment is saved as a separate stage item."
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search assessments by title, code, type, difficulty, or status"
        selectedCount={selectedIds.length}
        confirmLabel={`Add Assessments${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
        isConfirmDisabled={selectedIds.length === 0 || isSaving}
        isSubmitting={isSaving}
        onConfirm={() => void handleConfirm()}
        actions={(
          <>
            <Button type="button" variant="ghost" size="sm" disabled={visibleItems.length === 0} onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...visibleItems.map((item) => item.id)])))}>
              Select visible
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </>
        )}
        footerContent={(
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox checked={isRequired} onCheckedChange={(checked) => setIsRequired(checked === true)} disabled={isSaving} />
            Mark every selected assessment as required.
          </label>
        )}
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500">
            {normalizedSearch ? "No assessments match the current search." : "No assessments are available in the pool yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-slate-50",
                  selectedIds.includes(item.id) && "border-primary bg-primary/5",
                )}
                onClick={() => toggleSelection(item.id)}
              >
                <Checkbox
                  checked={selectedIds.includes(item.id)}
                  onCheckedChange={() => toggleSelection(item.id)}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <Badge variant="info">{QUESTION_TYPE_LABELS[item.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? item.questionType}</Badge>
                    <Badge variant="info">{item.difficultyLevel}</Badge>
                    <Badge variant="info">{item.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Code: {item.code}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CurriculumReferencePickerDialog>

      <Dialog open={confirmAutoLinkOpen} onOpenChange={setConfirmAutoLinkOpen}>
        <DialogContent size="sm" className="p-0">
          <DialogHeader>
            <DialogTitle>Link assessments to this course?</DialogTitle>
            <DialogDescription>
              {selectedUnlinkedItems.length === 1
                ? "The selected assessment is not linked to this course yet. Continuing will link it to the course and add it to this stage."
                : `${selectedUnlinkedItems.length} selected assessments are not linked to this course yet. Continuing will link them to the course and add them to this stage.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 py-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="space-y-2">
                {selectedUnlinkedItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">{item.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{item.code}</span>
                  </div>
                ))}
              </div>
              {selectedUnlinkedItems.length > 5 ? (
                <p className="mt-3 text-xs text-slate-500">+{selectedUnlinkedItems.length - 5} more assessment{selectedUnlinkedItems.length - 5 === 1 ? "" : "s"}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setConfirmAutoLinkOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
              {isSaving ? "Saving..." : "Link and add assessments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}