"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  CandidateEnrollmentPathFields,
  type CandidateBatchSelection,
  type CandidateCourseSelection,
  type CandidateProgramSelection,
} from "@/components/modules/candidates/candidate-enrollment-path-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type EnrollCandidateForm = {
  fullName: string;
  email: string;
  phone: string;
  courseId: string;
  courseName: string;
  programId: string;
  programName: string;
  batchCode: string;
  batchName: string;
  campus: string;
};

const initialForm: EnrollCandidateForm = {
  fullName: "",
  email: "",
  phone: "",
  courseId: "",
  courseName: "",
  programId: "",
  programName: "",
  batchCode: "",
  batchName: "",
  campus: "",
};

export function EnrollCandidateSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLearnerCode, setCreatedLearnerCode] = useState<string | null>(null);
  const [form, setForm] = useState<EnrollCandidateForm>(initialForm);

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email]);

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setCreatedLearnerCode(null);
    setForm(initialForm);
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.fullName.trim() || !normalizedEmail || !form.courseId || !form.programId || !form.batchCode) {
      setError("Please complete Full Name, Email, Course, Program, and Batch before continuing.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/learners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: normalizedEmail,
          phone: form.phone,
          programName: form.programName,
          batchCode: form.batchCode,
          campus: form.campus,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: { learnerCode?: string }; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create candidate.");
      }

      setCreatedLearnerCode(payload?.data?.learnerCode ?? null);
      setStep("created");
      router.refresh();
      toast.success("Candidate enrolled successfully.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create candidate.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCourseChange = (course: CandidateCourseSelection | null) => {
    setError(null);
    setForm((prev) => ({
      ...prev,
      courseId: course?.id ?? "",
      courseName: course?.name ?? "",
      programId: "",
      programName: "",
      batchCode: "",
      batchName: "",
      campus: "",
    }));
  };

  const handleProgramChange = (program: CandidateProgramSelection | null) => {
    setError(null);
    setForm((prev) => ({
      ...prev,
      programId: program?.id ?? "",
      programName: program?.name ?? "",
      batchCode: "",
      batchName: "",
      campus: "",
    }));
  };

  const handleBatchChange = (batch: CandidateBatchSelection | null) => {
    setError(null);
    setForm((prev) => ({
      ...prev,
      batchCode: batch?.code ?? "",
      batchName: batch?.name ?? "",
      campus: batch?.campus ?? "",
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>Enroll Candidate</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Enroll Candidate</SheetTitle>
          <SheetDescription>
            Add candidate details, choose the course, program, and batch in order, then confirm the enrollment.
          </SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Full Name</label>
                <Input
                  placeholder="Candidate name"
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</label>
                <Input
                  type="email"
                  placeholder="candidate@example.com"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</label>
                <Input
                  placeholder="+91 00000 00000"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
            </div>

            <CandidateEnrollmentPathFields
              open={open}
              value={{
                courseId: form.courseId,
                programId: form.programId,
                batchCode: form.batchCode,
              }}
              onCourseChange={handleCourseChange}
              onProgramChange={handleProgramChange}
              onBatchChange={handleBatchChange}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Campus</label>
              <Input
                placeholder="Auto-filled from batch, or adjust if needed"
                value={form.campus}
                onChange={(event) => setForm((prev) => ({ ...prev, campus: event.target.value }))}
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
            ) : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form.fullName.trim() || !normalizedEmail || !form.courseId || !form.programId || !form.batchCode}>
                Done
              </Button>
            </SheetFooter>
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Details captured. Click Create Candidate to finish enrollment.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Learner:</span> {form.fullName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Code:</span> Will be generated automatically
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email:</span> {normalizedEmail}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Course:</span> {form.courseName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Program:</span> {form.programName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Batch:</span> {form.batchName ? `${form.batchName} (${form.batchCode})` : form.batchCode}
              </p>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
            ) : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Candidate"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Candidate Created</p>
                <p className="text-sm text-blue-700">{form.fullName} has been created successfully.</p>
                {createdLearnerCode ? <p className="text-sm font-semibold text-blue-800">Generated code: {createdLearnerCode}</p> : null}
              </CardContent>
            </Card>

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}