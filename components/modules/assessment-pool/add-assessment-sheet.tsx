"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const QUESTION_TYPES = [
  { value: "MCQ", label: "Multiple Choice" },
  { value: "NUMERIC", label: "Numeric" },
  { value: "ESSAY", label: "Essay" },
  { value: "FILL_IN_THE_BLANK", label: "Fill in the Blank" },
  { value: "MULTI_INPUT_REASONING", label: "Multi-Input Reasoning" },
  { value: "TWO_PART_ANALYSIS", label: "Two-Part Analysis" },
];

const DIFFICULTY_LEVELS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

type AddAssessmentForm = {
  title: string;
  description: string;
  courseId: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes: string;
};

const initialForm: AddAssessmentForm = {
  title: "",
  description: "",
  courseId: "",
  questionType: "MCQ",
  difficultyLevel: "MEDIUM",
  totalMarks: 100,
  passingMarks: 40,
  timeLimitMinutes: "",
};

export function AddAssessmentSheet({
  open,
  onOpenChange,
  courseId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<AddAssessmentForm>({ ...initialForm, courseId: courseId || "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && courseId) {
      setForm((prev) => ({ ...prev, courseId }));
    }
  }, [open, courseId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/assessment-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          courseId: form.courseId || undefined,
          questionType: form.questionType,
          difficultyLevel: form.difficultyLevel,
          totalMarks: form.totalMarks,
          passingMarks: form.passingMarks,
          timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Failed to create assessment.");
      }

      toast.success("Assessment created.");
      setForm({ ...initialForm, courseId: courseId || "" });
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Assessment</SheetTitle>
          <SheetDescription>
            Create a new assessment in the pool. It can be linked to multiple courses and assigned to batches.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-1 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="e.g., German B1 Grammar Test"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Brief description of this assessment"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Question Type</label>
            <div className="grid grid-cols-2 gap-2">
              {QUESTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    form.questionType === type.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, questionType: type.value }))}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <div className="flex gap-2">
              {DIFFICULTY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.difficultyLevel === level.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, difficultyLevel: level.value }))}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Marks</label>
              <Input
                type="number"
                min={1}
                value={form.totalMarks}
                onChange={(e) => setForm((prev) => ({ ...prev, totalMarks: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Passing Marks</label>
              <Input
                type="number"
                min={0}
                value={form.passingMarks}
                onChange={(e) => setForm((prev) => ({ ...prev, passingMarks: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time (min)</label>
              <Input
                type="number"
                min={1}
                placeholder="—"
                value={form.timeLimitMinutes}
                onChange={(e) => setForm((prev) => ({ ...prev, timeLimitMinutes: e.target.value }))}
              />
            </div>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.title.trim()}>
              {isSubmitting ? "Creating…" : "Create Assessment"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
