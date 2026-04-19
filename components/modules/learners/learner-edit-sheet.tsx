"use client";

import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { LearnerAssignmentsCard } from "@/components/modules/learners/learner-assignments-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LearnerDetail } from "@/types";

type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
  trainerNames: string[];
};

type LearnerEditSheetProps = {
  learner: LearnerDetail | null;
};

const EXAM_OPTIONS = ["IELTS", "OET", "NCLEX", "GOETHE_A1", "GOETHE_A2", "GOETHE_B1", "GOETHE_B2", "PROMETRIC"] as const;

function getLearnerInitials(value: string | null | undefined) {
  return value
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CA";
}

export function LearnerEditSheet({ learner }: LearnerEditSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [batchCode, setBatchCode] = useState("");
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    dob: "",
    gender: "",
    targetCountry: "",
    targetLanguage: "",
    targetExam: "",
  });
  const open = Boolean(learner);

  const activeBatchCodes = useMemo(
    () => new Set((learner?.activeEnrollments ?? []).map((enrollment) => enrollment.batchCode.toLowerCase())),
    [learner?.activeEnrollments],
  );
  const learnerInitials = useMemo(() => getLearnerInitials(learner?.fullName), [learner?.fullName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setIsLoadingBatches(true);
    setError(null);

    fetch("/api/batches", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load batches.");
        }

        const payload = (await response.json()) as { data?: BatchOption[] };

        if (!active) {
          return;
        }

        const nextBatches = (payload.data ?? []).filter(
          (batch) => (batch.status === "PLANNED" || batch.status === "IN_SESSION") && !activeBatchCodes.has(batch.code.toLowerCase()),
        );

        setBatches(nextBatches);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load batches.";
        setError(message);
      })
      .finally(() => {
        if (active) {
          setIsLoadingBatches(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeBatchCodes, open]);

  useEffect(() => {
    setBatchCode("");
    setError(null);
    setSuccessMessage(null);
    setProfileError(null);
    setProfileSuccessMessage(null);
    setProfileForm({
      fullName: learner?.fullName ?? "",
      email: learner?.email ?? "",
      phone: learner?.phone ?? "",
      country: learner?.country ?? "",
      dob: learner?.dob ? learner.dob.slice(0, 10) : "",
      gender: learner?.gender ?? "",
      targetCountry: learner?.targetCountry ?? "",
      targetLanguage: learner?.targetLanguage ?? "",
      targetExam: learner?.targetExam ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner?.learnerCode]);

  const selectedBatch = batches.find((batch) => batch.code === batchCode) ?? null;

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("edit");

    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!learner || !batchCode) {
      setError("Select a batch before assigning the learner.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/learners/${learner.learnerCode}/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batchCode }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to assign learner to batch.");
      }

      setBatchCode("");
      setSuccessMessage("Learner enrolled successfully.");
      toast.success("Learner enrolled successfully.");
      startTransition(() => router.refresh());
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to assign learner to batch.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!learner) {
      return;
    }

    if (!profileForm.fullName.trim() || !profileForm.email.trim()) {
      setProfileError("Full name and email are required.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccessMessage(null);

    try {
      const response = await fetch(`/api/learners/${learner.learnerCode}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: profileForm.fullName,
          email: profileForm.email,
          phone: profileForm.phone,
          country: profileForm.country,
          dob: profileForm.dob,
          gender: profileForm.gender,
          targetCountry: profileForm.targetCountry,
          targetLanguage: profileForm.targetLanguage,
          targetExam: profileForm.targetExam.length > 0 ? profileForm.targetExam : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: LearnerDetail; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update learner profile.");
      }

      const updatedLearner = payload?.data;
      if (updatedLearner) {
        setProfileForm({
          fullName: updatedLearner.fullName,
          email: updatedLearner.email,
          phone: updatedLearner.phone ?? "",
          country: updatedLearner.country ?? "",
          dob: updatedLearner.dob ? updatedLearner.dob.slice(0, 10) : "",
          gender: updatedLearner.gender ?? "",
          targetCountry: updatedLearner.targetCountry ?? "",
          targetLanguage: updatedLearner.targetLanguage ?? "",
          targetExam: updatedLearner.targetExam ?? "",
        });
      }

      setProfileSuccessMessage("Learner profile updated successfully.");
      toast.success("Learner profile updated successfully.");
      startTransition(() => router.refresh());
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to update learner profile.";
      setProfileError(message);
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        {learner ? (
          <form className="flex h-full flex-col" onSubmit={handleSubmit}>
            <SheetHeader>
              <SheetTitle>Edit Learner</SheetTitle>
              <SheetDescription>Update learner profile details and manage active batch assignments.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-lg font-black text-slate-700">
                    {learner.profilePhotoUrl ? (
                      <img alt={`${learner.fullName} profile`} className="h-full w-full object-cover" src={learner.profilePhotoUrl} />
                    ) : (
                      <span>{learnerInitials}</span>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Learner</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{learner.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">Learner Code: {learner.learnerCode}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Full Name</label>
                    <Input
                      value={profileForm.fullName}
                      onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</label>
                    <Input
                      type="email"
                      value={profileForm.email}
                      onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</label>
                    <Input
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Country</label>
                    <Input
                      value={profileForm.country}
                      onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Date of Birth</label>
                    <Input
                      type="date"
                      value={profileForm.dob}
                      onChange={(event) => setProfileForm((current) => ({ ...current, dob: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Gender</label>
                    <Input
                      value={profileForm.gender}
                      onChange={(event) => setProfileForm((current) => ({ ...current, gender: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target Country</label>
                    <Input
                      value={profileForm.targetCountry}
                      onChange={(event) => setProfileForm((current) => ({ ...current, targetCountry: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target Language</label>
                    <Input
                      value={profileForm.targetLanguage}
                      onChange={(event) => setProfileForm((current) => ({ ...current, targetLanguage: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target Exam</label>
                    <select
                      className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                      value={profileForm.targetExam}
                      onChange={(event) => setProfileForm((current) => ({ ...current, targetExam: event.target.value }))}
                    >
                      <option value="">Not set</option>
                      {EXAM_OPTIONS.map((exam) => (
                        <option key={exam} value={exam}>
                          {exam}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="button" variant="secondary" onClick={() => void handleSaveProfile()} disabled={isSavingProfile || !profileForm.fullName.trim() || !profileForm.email.trim()}>
                    {isSavingProfile ? "Saving..." : "Save Profile"}
                  </Button>
                </div>

                {profileSuccessMessage ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{profileSuccessMessage}</p> : null}
                {profileError ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{profileError}</p> : null}
              </div>

              <LearnerAssignmentsCard
                enrollments={learner.activeEnrollments}
                description="Review all active batch and course allocations before assigning another batch."
                emptyMessage="This learner does not have any active batch assignments yet."
              />

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Add Enrollment</p>
                <p className="mt-2 text-sm text-slate-500">Select a planned or in-session batch to assign this learner. Existing active batches are hidden from the list.</p>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch</label>
                    <select
                      className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                      value={batchCode}
                      onChange={(event) => setBatchCode(event.target.value)}
                      disabled={isLoadingBatches || batches.length === 0}
                    >
                      <option value="">
                        {isLoadingBatches
                          ? "Loading batches..."
                          : batches.length === 0
                            ? "No additional active batches available"
                            : "Select a batch"}
                      </option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.code}>
                          {batch.name} ({batch.code}) - {batch.programName}
                          {batch.campus ? ` - ${batch.campus}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedBatch ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="font-bold text-slate-900">{selectedBatch.name}</p>
                      <p className="mt-1">{selectedBatch.programName}</p>
                      <p className="mt-1">{selectedBatch.campus ?? "Campus not assigned"}</p>
                      <p className="mt-1">{selectedBatch.trainerNames.length > 0 ? selectedBatch.trainerNames.join(", ") : "Trainer not assigned"}</p>
                    </div>
                  ) : null}

                  {successMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{successMessage}</p> : null}
                  {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button type="submit" disabled={isSubmitting || !batchCode || isLoadingBatches || batches.length === 0}>
                {isSubmitting ? "Assigning..." : "Assign to Batch"}
              </Button>
            </SheetFooter>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}