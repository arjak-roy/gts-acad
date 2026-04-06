"use client";

import { FormEvent, useEffect, useState } from "react";
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

type TrainerStatus = "ACTIVE" | "INACTIVE";

type TrainerDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  capacity: number;
  status: TrainerStatus;
  programs: string[];
  bio: string | null;
};

type EditTrainerForm = {
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  capacity: string;
  status: TrainerStatus;
  programs: string[];
  bio: string;
};

const initialForm: EditTrainerForm = {
  fullName: "",
  email: "",
  phone: "",
  specialization: "",
  capacity: "0",
  status: "ACTIVE",
  programs: [],
  bio: "",
};

type EditTrainerSheetProps = {
  trainerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditTrainerSheet({ trainerId, open, onOpenChange }: EditTrainerSheetProps) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm" | "updated">("form");
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<EditTrainerForm>(initialForm);

  useEffect(() => {
    if (!open || !trainerId) {
      return;
    }

    let active = true;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [trainerResponse, programsResponse] = await Promise.all([
          fetch(`/api/trainers/${trainerId}`, { cache: "no-store" }),
          fetch("/api/programs", { cache: "no-store" }),
        ]);

        if (!trainerResponse.ok || !programsResponse.ok) {
          throw new Error("Failed to load trainer details.");
        }

        const trainerPayload = (await trainerResponse.json()) as { data?: TrainerDetail };
        const programsPayload = (await programsResponse.json()) as { data?: ProgramOption[] };

        if (!active || !trainerPayload.data) {
          return;
        }

        setPrograms((programsPayload.data ?? []).filter((program) => program.isActive));
        setForm({
          fullName: trainerPayload.data.fullName,
          email: trainerPayload.data.email,
          phone: trainerPayload.data.phone ?? "",
          specialization: trainerPayload.data.specialization,
          capacity: String(trainerPayload.data.capacity),
          status: trainerPayload.data.status,
          programs: trainerPayload.data.programs,
          bio: trainerPayload.data.bio ?? "",
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load trainer details.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [open, trainerId]);

  const toggleProgram = (programName: string) => {
    setForm((prev) => ({
      ...prev,
      programs: prev.programs.includes(programName)
        ? prev.programs.filter((program) => program !== programName)
        : [...prev.programs, programName],
    }));
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const capacity = Number(form.capacity);
    if (!form.fullName.trim() || !form.email.trim() || !form.specialization.trim() || !Number.isFinite(capacity) || capacity < 0 || form.programs.length === 0) {
      setError("Please complete Name, Email, Specialization, Capacity, and select at least one program.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleUpdate = async () => {
    if (!trainerId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/trainers/${trainerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          specialization: form.specialization,
          capacity: Number(form.capacity),
          status: form.status,
          programs: form.programs,
          bio: form.bio,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update trainer.");
      }

      setStep("updated");
      router.refresh();
      toast.success("Trainer updated successfully.");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update trainer.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!trainerId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/trainers/${trainerId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to archive trainer.");
      }

      onOpenChange(false);
      router.refresh();
      toast.success("Trainer archived successfully.");
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : "Failed to archive trainer.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setForm(initialForm);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Trainer</SheetTitle>
          <SheetDescription>Update trainer details or archive this trainer profile.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="flex h-full flex-col overflow-hidden p-6" onSubmit={handleDone}>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {isLoading ? (
                <SheetLoadingSkeleton isLoading={true} variant="form" />
              ) : (
                <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Full Name</label>
                  <Input value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</label>
                  <Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</label>
                  <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Specialization</label>
                  <Input value={form.specialization} onChange={(event) => setForm((prev) => ({ ...prev, specialization: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Capacity</label>
                  <Input type="number" min={0} value={form.capacity} onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                  <select
                    className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TrainerStatus }))}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assigned Programs</label>
                <div className="grid max-h-60 gap-3 overflow-y-auto rounded-xl border border-[#dde1e6] p-3 sm:grid-cols-2">
                  {programs.length === 0 ? (
                    <p className="text-sm text-slate-500">No programs available.</p>
                  ) : (
                    programs.map((program) => {
                      const selected = form.programs.includes(program.name);

                      return (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => toggleProgram(program.name)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left transition-colors",
                            selected
                              ? "border-[#0d3b84] bg-blue-50 text-slate-900"
                              : "border-[#dde1e6] bg-white text-slate-700 hover:bg-slate-50",
                          )}
                          aria-pressed={selected}
                        >
                          <p className="text-sm font-semibold">{program.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{program.type}</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bio</label>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                  value={form.bio}
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                />
              </div>

              {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
                </>
              )}
            </div>

            {!isLoading ? (
              <SheetFooter className="p-0 pt-4 sm:justify-end sm:border-0">
                <CanAccess permission="trainers.delete">
                  <Button variant="ghost" type="button" className="text-rose-600" onClick={handleArchive} disabled={isSubmitting}>
                    Archive
                  </Button>
                </CanAccess>
                <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Done</Button>
              </SheetFooter>
            ) : null}
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Details captured. Click Update Trainer to save changes.</p>
              </CardContent>
            </Card>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Trainer"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "updated" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Trainer Updated</p>
                <p className="text-sm text-blue-700">{form.fullName.trim()} has been updated successfully.</p>
              </CardContent>
            </Card>

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
