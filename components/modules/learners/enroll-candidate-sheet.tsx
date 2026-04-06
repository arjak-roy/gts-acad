"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type EnrollCandidateForm = {
  fullName: string;
  email: string;
  phone: string;
  programName: string;
  batchCode: string;
  campus: string;
};

const initialForm: EnrollCandidateForm = {
  fullName: "",
  email: "",
  phone: "",
  programName: "",
  batchCode: "",
  campus: "",
};

export function EnrollCandidateSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLearnerCode, setCreatedLearnerCode] = useState<string | null>(null);
  const [form, setForm] = useState<EnrollCandidateForm>(initialForm);

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;

    const loadPrograms = async () => {
      setIsLoadingPrograms(true);

      try {
        const response = await fetch("/api/programs", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load programs.");
        }

        const payload = (await response.json()) as { data?: ProgramOption[] };
        const nextPrograms = payload.data ?? [];

        if (!isActive) {
          return;
        }

        setPrograms(nextPrograms.filter((program) => program.isActive));
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load programs.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoadingPrograms(false);
        }
      }
    };

    void loadPrograms();

    return () => {
      isActive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

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
        if (!response.ok) {
          throw new Error("Failed to load batches.");
        }

        const payload = (await response.json()) as { data?: BatchOption[] };
        const nextBatches = payload.data ?? [];

        if (!isActive) {
          return;
        }

        setBatches(nextBatches.filter((batch) => batch.status === "PLANNED" || batch.status === "IN_SESSION"));
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load batches.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoadingBatches(false);
        }
      }
    };

    void loadBatches();

    return () => {
      isActive = false;
    };
  }, [form.programName, open]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>Enroll Candidate</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Enroll Candidate</SheetTitle>
          <SheetDescription>
            Add candidate details, click Done to confirm, then create the candidate.
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                  value={form.programName}
                  onChange={(event) => setForm((prev) => ({ ...prev, programName: event.target.value, batchCode: "" }))}
                  disabled={isLoadingPrograms || programs.length === 0}
                >
                  <option value="">{isLoadingPrograms ? "Loading programs..." : programs.length === 0 ? "No programs available" : "Select a program"}</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.name}>
                      {program.name} ({program.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                  value={form.batchCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, batchCode: event.target.value }))}
                  disabled={!form.programName || isLoadingBatches || batches.length === 0}
                >
                  <option value="">
                    {!form.programName
                      ? "Select a program first"
                      : isLoadingBatches
                        ? "Loading batches..."
                        : batches.length === 0
                          ? "No batches available"
                          : "Select a batch"}
                  </option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.code}>
                      {batch.name} ({batch.code}){batch.campus ? ` - ${batch.campus}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Campus</label>
              <Input
                placeholder="Main Campus"
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
              <Button type="submit">Done</Button>
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
                <span className="font-semibold text-slate-900">Program:</span> {form.programName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Batch:</span> {(batches.find((batch) => batch.code === form.batchCode)?.name ?? form.batchCode) || "Not assigned"}
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