"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type ProgramOption = {
  id: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
  isActive: boolean;
};

type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
};

type OnboardCandidateForm = {
  fullName: string;
  email: string;
  phone: string;
  programName: string;
  batchCode: string;
  campus: string;
};

const initialForm: OnboardCandidateForm = {
  fullName: "",
  email: "",
  phone: "",
  programName: "",
  batchCode: "",
  campus: "",
};

type Props = {
  onCreated: () => void;
};

export function OnboardCandidateSheet({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardCandidateForm>(initialForm);

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email]);

  useEffect(() => {
    if (!open) return;

    let isActive = true;

    const loadPrograms = async () => {
      setIsLoadingPrograms(true);
      try {
        const response = await fetch("/api/programs", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load programs.");
        const payload = (await response.json()) as { data?: ProgramOption[] };
        if (!isActive) return;
        setPrograms((payload.data ?? []).filter((p) => p.isActive));
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load programs.");
      } finally {
        if (isActive) setIsLoadingPrograms(false);
      }
    };

    void loadPrograms();
    return () => { isActive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!form.programName) {
      setBatches([]);
      setIsLoadingBatches(false);
      return;
    }

    let isActive = true;

    const loadBatches = async () => {
      setIsLoadingBatches(true);
      try {
        const params = new URLSearchParams({ programName: form.programName });
        const response = await fetch(`/api/batches?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load batches.");
        const payload = (await response.json()) as { data?: BatchOption[] };
        if (!isActive) return;
        setBatches((payload.data ?? []).filter((b) => b.status === "PLANNED" || b.status === "IN_SESSION"));
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load batches.");
      } finally {
        if (isActive) setIsLoadingBatches(false);
      }
    };

    void loadBatches();
    return () => { isActive = false; };
  }, [form.programName, open]);

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

    if (!form.fullName.trim() || !normalizedEmail || !form.programName.trim()) {
      setError("Please complete Full Name, Email, and Program before continuing.");
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
                : "Create a new candidate account with program enrollment. A temporary password and welcome email will be sent automatically."}
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Program *</label>
                  {isLoadingPrograms ? (
                    <p className="text-sm text-slate-400">Loading programs...</p>
                  ) : (
                    <select
                      className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                      value={form.programName}
                      onChange={(e) => setForm((c) => ({ ...c, programName: e.target.value, batchCode: "" }))}
                    >
                      <option value="">Select program</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Batch</label>
                  {isLoadingBatches ? (
                    <p className="text-sm text-slate-400">Loading batches...</p>
                  ) : (
                    <select
                      className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                      value={form.batchCode}
                      onChange={(e) => setForm((c) => ({ ...c, batchCode: e.target.value }))}
                      disabled={!form.programName}
                    >
                      <option value="">No batch (optional)</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.code}>
                          {b.code} — {b.name}{b.campus ? ` (${b.campus})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Campus</label>
                  <Input value={form.campus} onChange={(e) => setForm((c) => ({ ...c, campus: e.target.value }))} placeholder="Optional" />
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
                    <span className="text-slate-500">Program</span>
                    <span className="font-semibold text-slate-900">{form.programName}</span>
                  </div>
                  {form.batchCode ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Batch</span>
                      <span className="font-semibold text-slate-900">{form.batchCode}</span>
                    </div>
                  ) : null}
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
                <Button type="submit" form="onboard-candidate-form" disabled={!form.fullName.trim() || !normalizedEmail || !form.programName.trim()}>
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
