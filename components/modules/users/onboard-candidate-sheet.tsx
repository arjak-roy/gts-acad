"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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

type OnboardCandidateForm = {
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

const initialForm: OnboardCandidateForm = {
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

type Props = {
  onCreated: () => void;
};

export function OnboardCandidateSheet({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardCandidateForm>(initialForm);

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email]);

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setCreatedName(null);
    setForm(initialForm);
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetFlow();
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
      const response = await fetch("/api/users/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          programName: form.programName,
          batchCode: form.batchCode,
          campus: form.campus,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: { name?: string }; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to onboard the candidate.");
      }

      setCreatedName(payload?.data?.name ?? form.fullName);
      setStep("created");
      onCreated();
      toast.success("Candidate onboarded successfully.");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to onboard the candidate.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCourseChange = (course: CandidateCourseSelection | null) => {
    setError(null);
    setForm((current) => ({
      ...current,
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
    setForm((current) => ({
      ...current,
      programId: program?.id ?? "",
      programName: program?.name ?? "",
      batchCode: "",
      batchName: "",
      campus: "",
    }));
  };

  const handleBatchChange = (batch: CandidateBatchSelection | null) => {
    setError(null);
    setForm((current) => ({
      ...current,
      batchCode: batch?.code ?? "",
      batchName: batch?.name ?? "",
      campus: batch?.campus ?? "",
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Onboard Candidate
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {step === "created" ? "Candidate Onboarded" : step === "confirm" ? "Confirm Details" : "Onboard Candidate"}
          </SheetTitle>
          <SheetDescription>
            {step === "created"
              ? "The candidate account has been created and a welcome email with temporary credentials has been sent."
              : step === "confirm"
                ? "Review the details below before creating the candidate account."
                : "Create a new candidate account with a guided course, program, and batch enrollment path. A temporary password and welcome email will be sent automatically."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</div> : null}

          {step === "form" ? (
            <form id="onboard-candidate-form" onSubmit={handleDone} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Full Name *</label>
                  <Input value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} placeholder="Aisha Sharma" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email *</label>
                  <Input value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="aisha@example.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              <div className="space-y-4">
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Campus</label>
                  <Input value={form.campus} onChange={(e) => setForm((c) => ({ ...c, campus: e.target.value }))} placeholder="Auto-filled from batch, or adjust if needed" />
                </div>
              </div>
            </form>
          ) : step === "confirm" ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Name</span>
                    <span className="font-semibold text-slate-900">{form.fullName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Email</span>
                    <span className="font-semibold text-slate-900">{normalizedEmail}</span>
                  </div>
                  {form.phone ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-semibold text-slate-900">{form.phone}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Course</span>
                    <span className="font-semibold text-slate-900">{form.courseName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Program</span>
                    <span className="font-semibold text-slate-900">{form.programName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Batch</span>
                    <span className="font-semibold text-slate-900">{form.batchName ? `${form.batchName} (${form.batchCode})` : form.batchCode}</span>
                  </div>
                  {form.campus ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Campus</span>
                      <span className="font-semibold text-slate-900">{form.campus}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <p className="text-xs text-slate-500">
                A temporary password will be generated and a welcome email with credentials will be sent to the candidate.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="text-5xl">&#127881;</div>
              <h3 className="text-lg font-bold text-slate-900">{createdName} has been onboarded!</h3>
              <p className="text-sm text-slate-500">A welcome email with login credentials has been dispatched. They can reset their password after first login via the candidate app.</p>
            </div>
          )}
        </div>

        <SheetFooter className="border-t px-6 py-4">
          {step === "form" ? (
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-500">A temporary password will be emailed automatically.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" form="onboard-candidate-form" disabled={!form.fullName.trim() || !normalizedEmail || !form.courseId || !form.programId || !form.batchCode}>
                  Review &amp; Confirm
                </Button>
              </div>
            </div>
          ) : step === "confirm" ? (
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("form")}>Back</Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Onboard Candidate
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
