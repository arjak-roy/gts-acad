"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type BatchModeValue = "ONLINE" | "OFFLINE";

type ProgramOption = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
  isActive: boolean;
};

type TrainerOption = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
  isActive: boolean;
  courses: string[];
};

type CenterOption = {
  id: string;
  name: string;
  addressSummary: string;
  isActive: boolean;
};

type CreateBatchForm = {
  code: string;
  name: string;
  programName: string;
  trainerIds: string[];
  centreId: string;
  startDate: string;
  capacity: string;
  mode: BatchModeValue;
};

const initialForm: CreateBatchForm = {
  code: "",
  name: "",
  programName: "",
  trainerIds: [],
  centreId: "",
  startDate: "",
  capacity: "25",
  mode: "OFFLINE",
};

type CreateBatchSheetProps = {
  courseId?: string | null;
  triggerLabel?: string;
  onCreated?: () => void;
};

function normalizeProgramKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function CreateBatchSheet({
  courseId = null,
  triggerLabel = "Create Batch",
  onCreated,
}: CreateBatchSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CreateBatchForm>(initialForm);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [trainerSearchTerm, setTrainerSearchTerm] = useState("");

  // Auto-generate batch code when program changes
  useEffect(() => {
    if (!form.programName || isLoadingPrograms) {
      return;
    }

    const generateCode = async () => {
      setIsGeneratingCode(true);
      try {
        const response = await fetch("/api/batches/generate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programName: form.programName }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to generate code");
        }

        const result = (await response.json()) as { data: { code: string } };
        setForm((prev) => ({ ...prev, code: result.data.code }));
      } catch (err) {
        console.warn("Code generation failed, using client-side fallback:", err);
        // Fallback: use prefix from program name
        const prefix = form.programName.substring(0, 3).toUpperCase();
        setForm((prev) => ({ ...prev, code: `B-${prefix}-001` }));
      } finally {
        setIsGeneratingCode(false);
      }
    };

    void generateCode();
  }, [form.programName, isLoadingPrograms]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;

    const loadPrograms = async () => {
      setIsLoadingPrograms(true);
      setIsLoadingTrainers(true);
      setIsLoadingCenters(true);

      try {
        const [programsResponse, trainersResponse, centersResponse] = await Promise.all([
          fetch("/api/programs", { cache: "no-store" }),
          fetch("/api/trainers", { cache: "no-store" }),
          fetch("/api/centers/options", { cache: "no-store" }),
        ]);

        if (!programsResponse.ok || !trainersResponse.ok || !centersResponse.ok) {
          throw new Error("Failed to load setup data.");
        }

        const programsPayload = (await programsResponse.json()) as { data?: ProgramOption[] };
        const trainersPayload = (await trainersResponse.json()) as { data?: TrainerOption[] };
        const centersPayload = (await centersResponse.json()) as { data?: CenterOption[] };

        if (!isActive) {
          return;
        }

        const availablePrograms = (programsPayload.data ?? []).filter(
          (program) => program.isActive && (!courseId || program.courseId === courseId),
        );

        setPrograms(availablePrograms);
        setTrainers((trainersPayload.data ?? []).filter((trainer) => trainer.isActive));
        setCenters((centersPayload.data ?? []).filter((center) => center.isActive));
        setForm((current) => {
          const hasCurrentProgram = availablePrograms.some((program) => program.name === current.programName);

          if (hasCurrentProgram) {
            return current;
          }

          if (courseId && availablePrograms.length === 1) {
            return {
              ...current,
              programName: availablePrograms[0].name,
            };
          }

          if (courseId) {
            return {
              ...current,
              programName: "",
              trainerIds: [],
            };
          }

          return current;
        });
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load programs.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoadingPrograms(false);
          setIsLoadingTrainers(false);
          setIsLoadingCenters(false);
        }
      }
    };

    void loadPrograms();

    return () => {
      isActive = false;
    };
  }, [courseId, open]);

  const selectedProgram = useMemo(
    () => programs.find((program) => normalizeProgramKey(program.name) === normalizeProgramKey(form.programName)) ?? null,
    [form.programName, programs],
  );

  const availableTrainers = useMemo(
    () => {
      if (!form.programName) {
        return trainers;
      }

      if (!selectedProgram) {
        return [];
      }

      const selectedCourseKey = normalizeProgramKey(selectedProgram.courseName);
      return trainers.filter((trainer) => trainer.courses.some((course) => normalizeProgramKey(course) === selectedCourseKey));
    },
    [form.programName, selectedProgram, trainers],
  );

  const selectedTrainerNames = useMemo(
    () => trainers.filter((trainer) => form.trainerIds.includes(trainer.id)).map((trainer) => trainer.fullName),
    [trainers, form.trainerIds],
  );

  const selectedSearchTrainers = useMemo(() => {
    if (!form.programName || !selectedProgram) {
      return [];
    }

    const selectedCourseKey = normalizeProgramKey(selectedProgram.courseName);
    return trainers.filter(
      (trainer) =>
        form.trainerIds.includes(trainer.id) &&
        !trainer.courses.some((course) => normalizeProgramKey(course) === selectedCourseKey),
    );
  }, [trainers, form.trainerIds, form.programName, selectedProgram]);

  const filteredSearchResults = useMemo(() => {
    if (!trainerSearchTerm.trim() || !form.programName) return [];

    const term = trainerSearchTerm.toLowerCase();
    return trainers.filter(
      (trainer) =>
        !form.trainerIds.includes(trainer.id) &&
        (trainer.fullName.toLowerCase().includes(term) ||
          trainer.email.toLowerCase().includes(term) ||
          trainer.specialization.toLowerCase().includes(term)),
    );
  }, [trainerSearchTerm, trainers, form.trainerIds, form.programName]);

  const selectedCenter = useMemo(
    () => centers.find((center) => center.id === form.centreId) ?? null,
    [centers, form.centreId],
  );

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setForm(initialForm);
    setTrainerSearchTerm("");
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const toggleTrainer = (trainerId: string) => {
    setForm((prev) => ({
      ...prev,
      trainerIds: prev.trainerIds.includes(trainerId)
        ? prev.trainerIds.filter((currentTrainerId) => currentTrainerId !== trainerId)
        : [...prev.trainerIds, trainerId],
    }));
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const capacity = Number(form.capacity);
    const startDate = new Date(form.startDate);

    if (!form.name.trim() || !form.programName.trim() || Number.isNaN(startDate.getTime()) || !Number.isFinite(capacity) || capacity < 1) {
      setError("Please complete Batch Name, Program, Start Date, and valid Capacity before continuing.");
      return;
    }

    if (form.mode === "OFFLINE" && !form.centreId) {
      setError("Select a physical center for offline batches.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          programName: form.programName,
          trainerIds: form.trainerIds,
          centreId: form.centreId,
          startDate: form.startDate,
          endDate: "",
          capacity: Number(form.capacity),
          mode: form.mode,
          status: "PLANNED",
          schedule: [],
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to create batch.");
      }

      setStep("created");
      router.refresh();
      onCreated?.();
      toast.success("Batch created successfully.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create batch.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>{triggerLabel}</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Batch</SheetTitle>
          <SheetDescription>Add batch details, click Done to confirm, then create the batch.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch Code</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {!form.programName ? (
                    <p className="text-sm text-slate-400">Select a program to generate code</p>
                  ) : isGeneratingCode ? (
                    <p className="text-sm text-slate-500">Generating code...</p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-700">{form.code}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch Name</label>
                <Input
                  placeholder="German April Weekend"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Name</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                  value={form.programName}
                  onChange={(event) => setForm((prev) => ({ ...prev, programName: event.target.value, trainerIds: [], mode: "OFFLINE" }))}
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
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assigned Trainers</label>
                  <span className="text-xs font-medium text-slate-500">{form.trainerIds.length} selected</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {!form.programName ? (
                    <p className="text-sm text-slate-500">Select a program to load trainers.</p>
                  ) : (
                    <>
                      {/* TRAINERS FROM COURSE */}
                      {form.programName && isLoadingTrainers ? <p className="text-sm text-slate-500">Loading trainers...</p> : null}
                      {form.programName && !isLoadingTrainers && availableTrainers.length === 0 ? <p className="text-sm text-slate-500">No active trainers are mapped to this course.</p> : null}
                      {form.programName && !isLoadingTrainers && availableTrainers.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2">From Course</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {availableTrainers.map((trainer) => {
                              const isSelected = form.trainerIds.includes(trainer.id);
                              return (
                                <button
                                  key={trainer.id}
                                  type="button"
                                  onClick={() => toggleTrainer(trainer.id)}
                                  className={cn(
                                    "rounded-2xl border px-3 py-3 text-left transition",
                                    isSelected
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100",
                                  )}
                                  aria-pressed={isSelected}
                                >
                                  <p className="text-sm font-semibold">{trainer.fullName}</p>
                                  <p className={cn("mt-1 text-xs", isSelected ? "text-slate-200" : "text-slate-500")}>{trainer.specialization}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* SEARCH FOR ALL TRAINERS */}
                      <div className="mt-4 border-t border-slate-300 pt-4">
                        <Input
                          type="text"
                          placeholder="Search to add more trainers"
                          value={trainerSearchTerm}
                          onChange={(e) => setTrainerSearchTerm(e.target.value)}
                          className="mb-3"
                        />
                        {trainerSearchTerm.trim() && filteredSearchResults.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold text-blue-600 mb-2">Search Results</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {filteredSearchResults.map((trainer) => {
                                const isInCourse = selectedProgram
                                  ? trainer.courses.some((course) => normalizeProgramKey(course) === normalizeProgramKey(selectedProgram.courseName))
                                  : false;
                                return (
                                  <button
                                    key={trainer.id}
                                    type="button"
                                    onClick={() => toggleTrainer(trainer.id)}
                                    className="rounded-2xl border border-blue-300 bg-blue-50 px-3 py-3 text-left transition hover:bg-blue-100"
                                  >
                                    <p className="text-sm font-semibold text-blue-900">{trainer.fullName}</p>
                                    <p className="mt-1 text-xs text-blue-700">{trainer.specialization}</p>
                                    {!isInCourse && (
                                      <p className="mt-1 text-xs font-medium text-blue-600">Will be added to course</p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : trainerSearchTerm.trim() ? (
                          <p className="text-sm text-slate-500">No trainers found.</p>
                        ) : null}

                        {selectedSearchTrainers.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-blue-600 mb-2">Added From Search</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedSearchTrainers.map((trainer) => (
                                <button
                                  key={trainer.id}
                                  type="button"
                                  onClick={() => toggleTrainer(trainer.id)}
                                  className="rounded-full border border-blue-300 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 transition hover:bg-blue-200"
                                >
                                  {trainer.fullName} ×
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Start Date</label>
                <Input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Capacity</label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mode</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                  value={form.mode}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    mode: event.target.value as BatchModeValue,
                    centreId: event.target.value === "ONLINE" ? "" : prev.centreId,
                  }))}
                >
                  <option value="OFFLINE">Offline</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Campus</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                  value={form.centreId}
                  onChange={(event) => setForm((prev) => ({ ...prev, centreId: event.target.value }))}
                  disabled={isLoadingCenters || centers.length === 0 || form.mode === "ONLINE"}
                >
                  <option value="">{form.mode === "ONLINE" ? "No center required for online batches" : isLoadingCenters ? "Loading centers..." : centers.length === 0 ? "No active centers available" : "Select a center"}</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
                {selectedCenter?.addressSummary ? <p className="text-xs text-slate-500">{selectedCenter.addressSummary}</p> : null}
              </div>
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
                <p className="text-sm text-emerald-700">Details captured. Click Create Batch to finish setup.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Code:</span> {form.code.trim().toUpperCase()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Batch:</span> {form.name.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Program:</span> {form.programName.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Campus:</span> {selectedCenter?.name ?? (form.mode === "ONLINE" ? "Not required" : "Not selected")}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Trainers:</span> {selectedTrainerNames.length > 0 ? selectedTrainerNames.join(", ") : "Unassigned"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Start:</span> {form.startDate}
              </p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Batch"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Batch Created</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been created successfully.</p>
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
