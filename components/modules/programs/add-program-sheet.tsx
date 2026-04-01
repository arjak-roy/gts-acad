"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ProgramTypeValue = "LANGUAGE" | "CLINICAL" | "TECHNICAL";

type AddProgramForm = {
  name: string;
  type: ProgramTypeValue;
  durationWeeks: string;
  category: string;
  description: string;
  trainerIds: string[];
  batchIds: string[];
};

type ProgramTrainerOption = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
  isActive: boolean;
  programs: string[];
};

type ProgramBatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  status: "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
};

const initialForm: AddProgramForm = {
  name: "",
  type: "LANGUAGE",
  durationWeeks: "",
  category: "",
  description: "",
  trainerIds: [],
  batchIds: [],
};

export function AddProgramSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [trainers, setTrainers] = useState<ProgramTrainerOption[]>([]);
  const [batches, setBatches] = useState<ProgramBatchOption[]>([]);
  const [trainerSearchTerm, setTrainerSearchTerm] = useState("");
  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [form, setForm] = useState<AddProgramForm>(initialForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadOptions = async () => {
      setIsLoadingOptions(true);

      try {
        const [trainersResponse, batchesResponse] = await Promise.all([
          fetch("/api/trainers", { cache: "no-store" }),
          fetch("/api/batches", { cache: "no-store" }),
        ]);

        if (!trainersResponse.ok || !batchesResponse.ok) {
          throw new Error("Failed to load trainers and batches.");
        }

        const trainersPayload = (await trainersResponse.json()) as { data?: ProgramTrainerOption[] };
        const batchesPayload = (await batchesResponse.json()) as { data?: ProgramBatchOption[] };

        if (!active) {
          return;
        }

        setTrainers((trainersPayload.data ?? []).filter((trainer) => trainer.isActive));
        setBatches((batchesPayload.data ?? []).filter((batch) => batch.status !== "ARCHIVED"));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load trainers and batches.";
        setError(message);
      } finally {
        if (active) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, [open]);

  const filteredTrainerResults = useMemo(() => {
    if (!trainerSearchTerm.trim()) {
      return [];
    }

    const term = trainerSearchTerm.toLowerCase();
    return trainers.filter(
      (trainer) =>
        !form.trainerIds.includes(trainer.id) &&
        (trainer.fullName.toLowerCase().includes(term) ||
          trainer.email.toLowerCase().includes(term) ||
          trainer.specialization.toLowerCase().includes(term) ||
          trainer.programs.some((program) => program.toLowerCase().includes(term))),
    );
  }, [trainerSearchTerm, trainers, form.trainerIds]);

  const filteredBatchResults = useMemo(() => {
    if (!batchSearchTerm.trim()) {
      return [];
    }

    const term = batchSearchTerm.toLowerCase();
    return batches.filter(
      (batch) =>
        !form.batchIds.includes(batch.id) &&
        (batch.code.toLowerCase().includes(term) ||
          batch.name.toLowerCase().includes(term) ||
          batch.programName.toLowerCase().includes(term)),
    );
  }, [batchSearchTerm, batches, form.batchIds]);

  const selectedTrainerNames = useMemo(
    () => trainers.filter((trainer) => form.trainerIds.includes(trainer.id)).map((trainer) => trainer.fullName),
    [trainers, form.trainerIds],
  );

  const selectedBatchNames = useMemo(
    () => batches.filter((batch) => form.batchIds.includes(batch.id)).map((batch) => `${batch.code} - ${batch.name}`),
    [batches, form.batchIds],
  );

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setForm(initialForm);
    setTrainerSearchTerm("");
    setBatchSearchTerm("");
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const duration = Number(form.durationWeeks);

    if (!form.name.trim() || !form.type || !Number.isFinite(duration) || duration < 1) {
      setError("Please complete Program Name, Type, and a valid Duration before continuing.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const toggleTrainer = (trainerId: string) => {
    setForm((prev) => ({
      ...prev,
      trainerIds: prev.trainerIds.includes(trainerId)
        ? prev.trainerIds.filter((id) => id !== trainerId)
        : [...prev.trainerIds, trainerId],
    }));
  };

  const toggleBatch = (batchId: string) => {
    setForm((prev) => ({
      ...prev,
      batchIds: prev.batchIds.includes(batchId)
        ? prev.batchIds.filter((id) => id !== batchId)
        : [...prev.batchIds, batchId],
    }));
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          durationWeeks: Number(form.durationWeeks),
          category: form.category,
          description: form.description,
          isActive: true,
          trainerIds: form.trainerIds,
          batchIds: form.batchIds,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to create program.");
      }

      setStep("created");
      router.refresh();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create program.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>Add Program</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Program</SheetTitle>
          <SheetDescription>Add program details, click Done to confirm, then create the program.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Name</label>
                <Input
                  placeholder="German Language B2"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Type</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ProgramTypeValue }))}
                >
                  <option value="LANGUAGE">Language</option>
                  <option value="CLINICAL">Clinical</option>
                  <option value="TECHNICAL">Technical</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Duration (Weeks)</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="24"
                  value={form.durationWeeks}
                  onChange={(event) => setForm((prev) => ({ ...prev, durationWeeks: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                <Input
                  placeholder="Nursing"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assign Trainers</label>
                  <span className="text-xs font-medium text-slate-500">{form.trainerIds.length} selected</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <Input
                    type="text"
                    placeholder="Search trainers by name, email, specialization"
                    value={trainerSearchTerm}
                    onChange={(event) => setTrainerSearchTerm(event.target.value)}
                    className="mb-3"
                  />
                  {isLoadingOptions ? <p className="text-sm text-slate-500">Loading trainers...</p> : null}
                  {!isLoadingOptions && trainerSearchTerm.trim() && filteredTrainerResults.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredTrainerResults.map((trainer) => (
                        <button
                          key={trainer.id}
                          type="button"
                          onClick={() => toggleTrainer(trainer.id)}
                          className="rounded-2xl border border-blue-300 bg-blue-50 px-3 py-3 text-left transition hover:bg-blue-100"
                        >
                          <p className="text-sm font-semibold text-blue-900">{trainer.fullName}</p>
                          <p className="mt-1 text-xs text-blue-700">{trainer.specialization}</p>
                          <p className="mt-1 text-xs text-blue-600">{trainer.email}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!isLoadingOptions && trainerSearchTerm.trim() && filteredTrainerResults.length === 0 ? (
                    <p className="text-sm text-slate-500">No trainers found.</p>
                  ) : null}
                  {form.trainerIds.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trainers
                        .filter((trainer) => form.trainerIds.includes(trainer.id))
                        .map((trainer) => (
                          <button
                            key={trainer.id}
                            type="button"
                            onClick={() => toggleTrainer(trainer.id)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold transition",
                              "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                            )}
                          >
                            {trainer.fullName} ×
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assign Batches</label>
                  <span className="text-xs font-medium text-slate-500">{form.batchIds.length} selected</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <Input
                    type="text"
                    placeholder="Search batches by code, name, program"
                    value={batchSearchTerm}
                    onChange={(event) => setBatchSearchTerm(event.target.value)}
                    className="mb-3"
                  />
                  {isLoadingOptions ? <p className="text-sm text-slate-500">Loading batches...</p> : null}
                  {!isLoadingOptions && batchSearchTerm.trim() && filteredBatchResults.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredBatchResults.map((batch) => (
                        <button
                          key={batch.id}
                          type="button"
                          onClick={() => toggleBatch(batch.id)}
                          className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-left transition hover:bg-amber-100"
                        >
                          <p className="text-sm font-semibold text-amber-900">{batch.code}</p>
                          <p className="mt-1 text-xs text-amber-700">{batch.name}</p>
                          <p className="mt-1 text-xs text-amber-600">Current program: {batch.programName}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!isLoadingOptions && batchSearchTerm.trim() && filteredBatchResults.length === 0 ? (
                    <p className="text-sm text-slate-500">No batches found.</p>
                  ) : null}
                  {form.batchIds.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {batches
                        .filter((batch) => form.batchIds.includes(batch.id))
                        .map((batch) => (
                          <button
                            key={batch.id}
                            type="button"
                            onClick={() => toggleBatch(batch.id)}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                          >
                            {batch.code} ×
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                placeholder="Program overview and outcomes"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

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
                <p className="text-sm text-emerald-700">Details captured. Click Create Program to finish setup.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Program:</span> {form.name.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Type:</span> {form.type}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Duration:</span> {Number(form.durationWeeks)} weeks
              </p>
              <p>
                <span className="font-semibold text-slate-900">Category:</span> {form.category.trim() || "N/A"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Trainers:</span> {selectedTrainerNames.length > 0 ? selectedTrainerNames.join(", ") : "Unassigned"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Batches:</span> {selectedBatchNames.length > 0 ? selectedBatchNames.join(", ") : "Unassigned"}
              </p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Program"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Program Created</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been added successfully.</p>
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
