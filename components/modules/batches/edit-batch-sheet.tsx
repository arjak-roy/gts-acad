"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import { cn } from "@/lib/utils";

type ProgramOption = {
  id: string;
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
  programs: string[];
};

type CenterOption = {
  id: string;
  name: string;
  addressSummary: string;
  isActive: boolean;
};

type BatchStatusValue = "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
type BatchModeValue = "ONLINE" | "OFFLINE";

type BatchDetail = {
  id: string;
  code: string;
  name: string;
  programName: string;
  centreId?: string | null;
  centreAddress?: string | null;
  trainerIds?: string[];
  trainerNames?: string[];
  campus?: string | null;
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  mode?: BatchModeValue;
  status?: BatchStatusValue;
  schedule?: string[];
};

type EditBatchForm = {
  code: string;
  name: string;
  programName: string;
  trainerIds: string[];
  centreId: string;
  startDate: string;
  endDate: string;
  capacity: string;
  mode: BatchModeValue;
  status: BatchStatusValue;
  schedule: string;
};

const emptyForm: EditBatchForm = {
  code: "",
  name: "",
  programName: "",
  trainerIds: [],
  centreId: "",
  startDate: "",
  endDate: "",
  capacity: "25",
  mode: "OFFLINE",
  status: "PLANNED",
  schedule: "",
};

function normalizeProgramKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

type EditBatchSheetProps = {
  batchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditBatchSheet({ batchId, open, onOpenChange }: EditBatchSheetProps) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm" | "updated">("form");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [form, setForm] = useState<EditBatchForm>(emptyForm);
  const [trainerSearchTerm, setTrainerSearchTerm] = useState("");

  useEffect(() => {
    if (!open || !batchId) {
      return;
    }

    let isActive = true;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [batchResponse, programsResponse, trainersResponse, centersResponse] = await Promise.all([
          fetch(`/api/batches/${batchId}`, { cache: "no-store" }),
          fetch("/api/programs", { cache: "no-store" }),
          fetch("/api/trainers", { cache: "no-store" }),
          fetch("/api/centers/options", { cache: "no-store" }),
        ]);

        if (!batchResponse.ok || !programsResponse.ok || !trainersResponse.ok || !centersResponse.ok) {
          throw new Error("Failed to load batch details.");
        }

        const batchPayload = (await batchResponse.json()) as { data?: BatchDetail };
        const programsPayload = (await programsResponse.json()) as { data?: ProgramOption[] };
        const trainersPayload = (await trainersResponse.json()) as { data?: TrainerOption[] };
        const centersPayload = (await centersResponse.json()) as { data?: CenterOption[] };

        if (!isActive || !batchPayload.data) {
          return;
        }

        const batchData = batchPayload.data;
        setPrograms((programsPayload.data ?? []).filter((program) => program.isActive));
        setTrainers((trainersPayload.data ?? []).filter((trainer) => trainer.isActive));
        const availableCenters = (centersPayload.data ?? []).filter((center) => center.isActive);
        setCenters(availableCenters);
        const fallbackCenterId = batchData.centreId
          ?? availableCenters.find((center) => center.name.toLowerCase() === (batchData.campus ?? "").toLowerCase())?.id
          ?? "";
        setForm({
          code: batchData.code,
          name: batchData.name,
          programName: batchData.programName,
          trainerIds: batchData.trainerIds ?? [],
          centreId: fallbackCenterId,
          startDate: batchData.startDate?.slice(0, 10) ?? "",
          endDate: batchData.endDate?.slice(0, 10) ?? "",
          capacity: String(batchData.capacity ?? 25),
          mode: batchData.mode ?? "OFFLINE",
          status: batchData.status ?? "PLANNED",
          schedule: (batchData.schedule ?? []).join(", "),
        });
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load batch details.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, [batchId, open]);

  const availableTrainers = useMemo(
    () => {
      if (!form.programName) {
        return trainers;
      }

      const selectedProgramKey = normalizeProgramKey(form.programName);
      return trainers.filter((trainer) => trainer.programs.some((program) => normalizeProgramKey(program) === selectedProgramKey));
    },
    [form.programName, trainers],
  );

  const selectedTrainerNames = useMemo(
    () => trainers.filter((trainer) => form.trainerIds.includes(trainer.id)).map((trainer) => trainer.fullName),
    [trainers, form.trainerIds],
  );

  const selectedSearchTrainers = useMemo(() => {
    if (!form.programName) {
      return [];
    }

    const selectedProgramKey = normalizeProgramKey(form.programName);
    return trainers.filter(
      (trainer) =>
        form.trainerIds.includes(trainer.id) &&
        !trainer.programs.some((program) => normalizeProgramKey(program) === selectedProgramKey),
    );
  }, [trainers, form.trainerIds, form.programName]);

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

  const resetState = () => {
    setStep("form");
    setError(null);
    setForm(emptyForm);
    setTrainerSearchTerm("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetState();
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
    if (!form.code.trim() || !form.name.trim() || !form.programName.trim() || !form.startDate || !Number.isFinite(capacity) || capacity < 1) {
      setError("Please complete Code, Name, Program, Start Date, and valid Capacity before continuing.");
      return;
    }

    if (form.mode === "OFFLINE" && !form.centreId) {
      setError("Select a physical center for offline batches.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleUpdate = async () => {
    if (!batchId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
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
          endDate: form.endDate,
          capacity: Number(form.capacity),
          mode: form.mode,
          status: form.status,
          schedule: form.schedule
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update batch.");
      }

      setStep("updated");
      router.refresh();
      toast.success("Batch updated successfully.");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update batch.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!batchId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to archive batch.");
      }

      handleOpenChange(false);
      router.refresh();
      toast.success("Batch archived successfully.");
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : "Failed to archive batch.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Batch</SheetTitle>
          <SheetDescription>Update batch details and manage all trainers assigned to this batch.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            {isLoading ? (
              <SheetLoadingSkeleton isLoading={true} variant="form" />
            ) : (
              <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch Code</label>
                <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch Name</label>
                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                  value={form.programName}
                  onChange={(event) => setForm((prev) => ({ ...prev, programName: event.target.value, trainerIds: [] }))}
                >
                  <option value="">Select a program</option>
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
                      {/* TRAINERS FROM PROGRAM */}
                      {availableTrainers.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2">From Program</p>
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
                      ) : (
                        <p className="text-sm text-slate-500">No trainers from this program yet.</p>
                      )}

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
                                const isInProgram = trainer.programs.some(
                                  (p) => p.trim().toLowerCase() === form.programName.trim().toLowerCase(),
                                );
                                return (
                                  <button
                                    key={trainer.id}
                                    type="button"
                                    onClick={() => toggleTrainer(trainer.id)}
                                    className="rounded-2xl border border-blue-300 bg-blue-50 px-3 py-3 text-left transition hover:bg-blue-100"
                                  >
                                    <p className="text-sm font-semibold text-blue-900">{trainer.fullName}</p>
                                    <p className="mt-1 text-xs text-blue-700">{trainer.specialization}</p>
                                    {!isInProgram && (
                                      <p className="mt-1 text-xs font-medium text-blue-600">⚠ Will be added to program</p>
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
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">End Date</label>
                <Input type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Capacity</label>
                <Input type="number" min={1} value={form.capacity} onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Campus</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                  value={form.centreId}
                  onChange={(event) => setForm((prev) => ({ ...prev, centreId: event.target.value }))}
                  disabled={centers.length === 0 || form.mode === "ONLINE"}
                >
                  <option value="">{form.mode === "ONLINE" ? "No center required for online batches" : centers.length === 0 ? "No active centers available" : "Select a center"}</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
                {selectedCenter?.addressSummary ? <p className="text-xs text-slate-500">{selectedCenter.addressSummary}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mode</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700" value={form.mode} onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as BatchModeValue, centreId: event.target.value === "ONLINE" ? "" : prev.centreId }))}>
                  <option value="OFFLINE">Offline</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as BatchStatusValue }))}>
                  <option value="DRAFT">Draft</option>
                  <option value="PLANNED">Planned</option>
                  <option value="IN_SESSION">In Session</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Schedule</label>
              <Input value={form.schedule} placeholder="MON, TUE, WED" onChange={(event) => setForm((prev) => ({ ...prev, schedule: event.target.value }))} />
            </div>
            </>
            )}

            {!isLoading ? (
              <>
                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
                <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
                  <CanAccess permission="batches.delete">
                    <Button variant="ghost" type="button" className="text-rose-600" onClick={handleArchive} disabled={isSubmitting}>
                      Archive
                    </Button>
                  </CanAccess>
                  <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Done</Button>
                </SheetFooter>
              </>
            ) : null}
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Review the changes and click Update Batch to save them.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">Code:</span> {form.code.trim().toUpperCase()}</p>
              <p><span className="font-semibold text-slate-900">Batch:</span> {form.name.trim()}</p>
              <p><span className="font-semibold text-slate-900">Program:</span> {form.programName}</p>
              <p><span className="font-semibold text-slate-900">Campus:</span> {selectedCenter?.name ?? (form.mode === "ONLINE" ? "Not required" : "Not selected")}</p>
              <p><span className="font-semibold text-slate-900">Trainers:</span> {selectedTrainerNames.length > 0 ? selectedTrainerNames.join(", ") : "Unassigned"}</p>
              <p><span className="font-semibold text-slate-900">Status:</span> {form.status}</p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>Back</Button>
              <Button type="button" onClick={handleUpdate} disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update Batch"}</Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "updated" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Batch Updated</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been updated successfully.</p>
              </CardContent>
            </Card>

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>Close</Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}