"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes: string;
};

type AssessmentCreateStep = "BASICS" | "QUESTIONS" | "REVIEW";

type FormErrorKey =
  | "title"
  | "description"
  | "questionType"
  | "difficultyLevel"
  | "totalMarks"
  | "passingMarks"
  | "timeLimitMinutes";

type FormErrors = Partial<Record<FormErrorKey, string>>;

type CreatedAssessmentPayload = {
  id: string;
};

const initialForm: AddAssessmentForm = {
  title: "",
  description: "",
  questionType: "MCQ",
  difficultyLevel: "MEDIUM",
  totalMarks: 100,
  passingMarks: 40,
  timeLimitMinutes: "",
};

const STEP_SEQUENCE: { id: AssessmentCreateStep; label: string; helper: string }[] = [
  { id: "BASICS", label: "Basics", helper: "Identity and context" },
  { id: "QUESTIONS", label: "Question Setup", helper: "Type and scoring" },
  { id: "REVIEW", label: "Review", helper: "Confirm and continue" },
];

function createInitialForm(): AddAssessmentForm {
  return {
    ...initialForm,
  };
}

function hasErrors(errors: FormErrors) {
  return Object.keys(errors).length > 0;
}

function validateBasics(form: AddAssessmentForm): FormErrors {
  const errors: FormErrors = {};
  const trimmedTitle = form.title.trim();
  const trimmedDescription = form.description.trim();

  if (trimmedTitle.length < 2) {
    errors.title = "Title must be at least 2 characters.";
  }

  if (trimmedDescription.length > 2000) {
    errors.description = "Description cannot exceed 2000 characters.";
  }

  return errors;
}

function validateQuestionSetup(form: AddAssessmentForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.questionType) {
    errors.questionType = "Select a question type.";
  }

  if (!form.difficultyLevel) {
    errors.difficultyLevel = "Select a difficulty level.";
  }

  if (!Number.isFinite(form.totalMarks) || form.totalMarks < 1) {
    errors.totalMarks = "Total marks must be at least 1.";
  }

  if (!Number.isFinite(form.passingMarks) || form.passingMarks < 0) {
    errors.passingMarks = "Passing marks cannot be negative.";
  } else if (form.passingMarks > form.totalMarks) {
    errors.passingMarks = "Passing marks cannot exceed total marks.";
  }

  if (form.timeLimitMinutes.trim()) {
    const parsedLimit = Number(form.timeLimitMinutes);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      errors.timeLimitMinutes = "Time limit must be at least 1 minute.";
    }
  }

  return errors;
}

export function AddAssessmentSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (poolId: string) => void;
}) {
  const [form, setForm] = useState<AddAssessmentForm>(createInitialForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<AssessmentCreateStep>("BASICS");
  const [showStepErrors, setShowStepErrors] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FormErrorKey, boolean>>>({});
  const wasOpenRef = useRef(false);

  const initialSnapshot = useMemo(() => createInitialForm(), []);
  const basicsErrors = useMemo(() => validateBasics(form), [form]);
  const questionSetupErrors = useMemo(() => validateQuestionSetup(form), [form]);
  const allErrors = useMemo(
    () => ({ ...basicsErrors, ...questionSetupErrors }),
    [basicsErrors, questionSetupErrors],
  );

  const isDirty = useMemo(
    () => (
      form.title !== initialSnapshot.title
      || form.description !== initialSnapshot.description
      || form.questionType !== initialSnapshot.questionType
      || form.difficultyLevel !== initialSnapshot.difficultyLevel
      || form.totalMarks !== initialSnapshot.totalMarks
      || form.passingMarks !== initialSnapshot.passingMarks
      || form.timeLimitMinutes !== initialSnapshot.timeLimitMinutes
    ),
    [form, initialSnapshot],
  );

  const resetWorkflow = useCallback(() => {
    setForm(createInitialForm());
    setCurrentStep("BASICS");
    setShowStepErrors(false);
    setShowDiscardConfirm(false);
    setTouchedFields({});
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetWorkflow();
    }

    wasOpenRef.current = open;
  }, [open, resetWorkflow]);

  const markTouched = (field: FormErrorKey) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const shouldShowFieldError = (field: FormErrorKey) => Boolean(showStepErrors || touchedFields[field]);

  const requestClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    resetWorkflow();
    onOpenChange(false);
  }, [isDirty, isSubmitting, onOpenChange, resetWorkflow]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    requestClose();
  };

  const handleNextStep = () => {
    setShowStepErrors(true);

    if (currentStep === "BASICS") {
      if (hasErrors(basicsErrors)) {
        return;
      }

      setCurrentStep("QUESTIONS");
      setShowStepErrors(false);
      return;
    }

    if (currentStep === "QUESTIONS") {
      if (hasErrors(questionSetupErrors)) {
        return;
      }

      setCurrentStep("REVIEW");
      setShowStepErrors(false);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === "QUESTIONS") {
      setCurrentStep("BASICS");
      setShowStepErrors(false);
      return;
    }

    if (currentStep === "REVIEW") {
      setCurrentStep("QUESTIONS");
      setShowStepErrors(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (currentStep !== "REVIEW") {
      handleNextStep();
      return;
    }

    setShowStepErrors(true);

    if (hasErrors(allErrors)) {
      if (hasErrors(basicsErrors)) {
        setCurrentStep("BASICS");
      } else if (hasErrors(questionSetupErrors)) {
        setCurrentStep("QUESTIONS");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/assessment-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          questionType: form.questionType,
          difficultyLevel: form.difficultyLevel,
          totalMarks: form.totalMarks,
          passingMarks: form.passingMarks,
          timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
        }),
      });

      const responsePayload = (await response.json()) as {
        data?: CreatedAssessmentPayload;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(responsePayload.error || "Failed to create assessment.");
      }

      const createdPoolId = responsePayload.data?.id;
      if (!createdPoolId) {
        throw new Error("Assessment created but could not open details.");
      }

      toast.success("Assessment created.");
      resetWorkflow();
      onOpenChange(false);
      onCreated(createdPoolId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeStepIndex = STEP_SEQUENCE.findIndex((step) => step.id === currentStep);

  const titleError = shouldShowFieldError("title") ? basicsErrors.title : undefined;
  const descriptionError = shouldShowFieldError("description") ? basicsErrors.description : undefined;
  const totalMarksError = shouldShowFieldError("totalMarks") ? questionSetupErrors.totalMarks : undefined;
  const passingMarksError = shouldShowFieldError("passingMarks") ? questionSetupErrors.passingMarks : undefined;
  const timeLimitError = shouldShowFieldError("timeLimitMinutes") ? questionSetupErrors.timeLimitMinutes : undefined;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="space-y-4">
          <DialogTitle>Create Assessment</DialogTitle>
          <DialogDescription>
            Build the assessment setup in guided steps, then continue directly into question authoring.
          </DialogDescription>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {STEP_SEQUENCE.map((step, index) => {
              const isActive = currentStep === step.id;
              const isComplete = index < activeStepIndex;

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border px-3 py-2 text-left ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isComplete
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-primary text-white"
                          : isComplete
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <p className="text-xs font-semibold text-slate-900">{step.label}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{step.helper}</p>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {currentStep === "BASICS" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assessment Title</label>
                  <Input
                    placeholder="e.g., German B1 Grammar Test"
                    value={form.title}
                    onBlur={() => markTouched("title")}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, title: e.target.value }));
                      if (!touchedFields.title) {
                        return;
                      }
                      markTouched("title");
                    }}
                  />
                  {titleError ? <p className="text-xs text-rose-600">{titleError}</p> : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (optional)</label>
                  <textarea
                    className="w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm min-h-[110px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                    placeholder="What this assessment measures, expected level, and intended usage."
                    value={form.description}
                    onBlur={() => markTouched("description")}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, description: e.target.value }));
                      if (!touchedFields.description) {
                        return;
                      }
                      markTouched("description");
                    }}
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Keep it short and operational for trainers and schedulers.</span>
                    <span>{form.description.length}/2000</span>
                  </div>
                  {descriptionError ? <p className="text-xs text-rose-600">{descriptionError}</p> : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-700">Pool Placement</p>
                  <p className="mt-1 text-sm text-slate-600">
                    This assessment will be created in the shared pool first, then linked to courses where it should be delivered.
                  </p>
                </div>
              </>
            ) : null}

            {currentStep === "QUESTIONS" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Question Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {QUESTION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
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
                        className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
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
                      value={Number.isFinite(form.totalMarks) ? form.totalMarks : 0}
                      onBlur={() => markTouched("totalMarks")}
                      onChange={(e) => {
                        const nextValue = Number(e.target.value);
                        setForm((prev) => ({ ...prev, totalMarks: Number.isFinite(nextValue) ? nextValue : 0 }));
                      }}
                    />
                    {totalMarksError ? <p className="text-xs text-rose-600">{totalMarksError}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Passing Marks</label>
                    <Input
                      type="number"
                      min={0}
                      value={Number.isFinite(form.passingMarks) ? form.passingMarks : 0}
                      onBlur={() => markTouched("passingMarks")}
                      onChange={(e) => {
                        const nextValue = Number(e.target.value);
                        setForm((prev) => ({ ...prev, passingMarks: Number.isFinite(nextValue) ? nextValue : 0 }));
                      }}
                    />
                    {passingMarksError ? <p className="text-xs text-rose-600">{passingMarksError}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time (min)</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Optional"
                      value={form.timeLimitMinutes}
                      onBlur={() => markTouched("timeLimitMinutes")}
                      onChange={(e) => setForm((prev) => ({ ...prev, timeLimitMinutes: e.target.value }))}
                    />
                    {timeLimitError ? <p className="text-xs text-rose-600">{timeLimitError}</p> : null}
                  </div>
                </div>
              </>
            ) : null}

            {currentStep === "REVIEW" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Ready to create</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Once created, this sheet closes and the new assessment opens immediately in detail view so you can add or import questions without extra clicks.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Title</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{form.title.trim() || "Untitled"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Placement</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Shared assessment pool</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Question Type</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{QUESTION_TYPES.find((type) => type.value === form.questionType)?.label ?? form.questionType}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Difficulty</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{DIFFICULTY_LEVELS.find((level) => level.value === form.difficultyLevel)?.label ?? form.difficultyLevel}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Marks</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{form.passingMarks}/{form.totalMarks} required to pass</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Time Limit</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{form.timeLimitMinutes.trim() ? `${form.timeLimitMinutes} min` : "No time limit"}</p>
                  </div>
                </div>

                {showStepErrors && hasErrors(allErrors) ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    Some required values are still invalid. Go back and resolve highlighted fields.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-slate-100 px-1 py-4">
            {showDiscardConfirm ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">Discard draft changes?</p>
                <p className="mt-1 text-xs text-amber-800">You have unsaved assessment setup. This action cannot be undone.</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowDiscardConfirm(false)}>
                    Keep editing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      setShowDiscardConfirm(false);
                      resetWorkflow();
                      onOpenChange(false);
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 px-6">
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={requestClose}>
                  Cancel
                </Button>
                {currentStep !== "BASICS" ? (
                  <Button type="button" variant="ghost" onClick={handlePreviousStep}>
                    Back
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="info" className="text-[9px] px-2 py-0.5 tracking-[0.16em]">
                  Step {activeStepIndex + 1} of {STEP_SEQUENCE.length}
                </Badge>
                {currentStep === "REVIEW" ? (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create and continue"}
                  </Button>
                ) : (
                  <Button type="button" onClick={handleNextStep}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
