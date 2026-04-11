"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TRAINER_AVAILABILITY_LABELS, type TrainerAvailabilityStatus, type TrainerStatus } from "@/services/trainers/types";
import { cn } from "@/lib/utils";

function formatSelectedCourseNames(courseIds: string[], courseOptions: CourseOption[]) {
  return courseOptions
    .filter((course) => courseIds.includes(course.id))
    .map((course) => course.name);
}

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type AddTrainerForm = {
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  specialization: string;
  capacity: string;
  status: TrainerStatus;
  availabilityStatus: TrainerAvailabilityStatus;
  courseIds: string[];
  bio: string;
};

const initialForm: AddTrainerForm = {
  fullName: "",
  employeeCode: "",
  email: "",
  phone: "",
  specialization: "",
  capacity: "0",
  status: "ACTIVE",
  availabilityStatus: "AVAILABLE",
  courseIds: [],
  bio: "",
};

type AddTrainerSheetProps = {
  onCreated?: () => void;
};

export function AddTrainerSheet({ onCreated }: AddTrainerSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AddTrainerForm>(initialForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;

    const loadCourses = async () => {
      setIsLoadingCourses(true);

      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load courses.");
        }

        const payload = (await response.json()) as { data?: CourseOption[] };
        if (!isActive) {
          return;
        }

        setCourses((payload.data ?? []).filter((course) => course.isActive));
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load courses.";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoadingCourses(false);
        }
      }
    };

    void loadCourses();

    return () => {
      isActive = false;
    };
  }, [open]);

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setForm(initialForm);
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const selectedCourseNames = formatSelectedCourseNames(form.courseIds, courses);

  const toggleCourse = (courseId: string) => {
    setForm((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((currentCourseId) => currentCourseId !== courseId)
        : [...prev.courseIds, courseId],
    }));
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const capacity = Number(form.capacity);
    if (!form.fullName.trim() || !form.employeeCode.trim() || !form.email.trim() || !form.specialization.trim() || !Number.isFinite(capacity) || capacity < 0 || form.courseIds.length === 0) {
      setError("Please complete Name, Employee Code, Email, Specialization, Capacity, and select at least one course.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/trainers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName,
          employeeCode: form.employeeCode,
          email: form.email,
          phone: form.phone,
          specialization: form.specialization,
          capacity: Number(form.capacity),
          status: form.status,
          availabilityStatus: form.availabilityStatus,
          courses: form.courseIds,
          bio: form.bio,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create trainer.");
      }

      setStep("created");
      router.refresh();
  onCreated?.();
      toast.success("Trainer created successfully.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create trainer.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>Add Trainer</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Trainer</SheetTitle>
          <SheetDescription>Add trainer details, review them, then create the trainer profile.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="flex h-full flex-col overflow-hidden p-6" onSubmit={handleDone}>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Full Name</label>
                  <Input value={form.fullName} placeholder="Trainer name" onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Employee Code</label>
                  <Input value={form.employeeCode} placeholder="TRN-0001" onChange={(event) => setForm((prev) => ({ ...prev, employeeCode: event.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</label>
                  <Input type="email" value={form.email} placeholder="trainer@example.com" onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</label>
                  <Input value={form.phone} placeholder="+91 00000 00000" onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Specialization</label>
                  <Input value={form.specialization} placeholder="German Language" onChange={(event) => setForm((prev) => ({ ...prev, specialization: event.target.value }))} />
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
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Availability</label>
                  <select
                    className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                    value={form.availabilityStatus}
                    onChange={(event) => setForm((prev) => ({ ...prev, availabilityStatus: event.target.value as TrainerAvailabilityStatus }))}
                  >
                    {Object.entries(TRAINER_AVAILABILITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assigned Courses</label>
                <div className="grid max-h-60 gap-3 overflow-y-auto rounded-xl border border-[#dde1e6] p-3 sm:grid-cols-2">
                  {isLoadingCourses ? (
                    <p className="text-sm text-slate-500">Loading courses...</p>
                  ) : courses.length === 0 ? (
                    <p className="text-sm text-slate-500">No courses available.</p>
                  ) : (
                    courses.map((course) => {
                      const selected = form.courseIds.includes(course.id);

                      return (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => toggleCourse(course.id)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left transition-colors",
                            selected
                              ? "border-[#0d3b84] bg-blue-50 text-slate-900"
                              : "border-[#dde1e6] bg-white text-slate-700 hover:bg-slate-50",
                          )}
                          aria-pressed={selected}
                        >
                          <p className="text-sm font-semibold">{course.name}</p>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-slate-500">Tap or click cards to select one or more courses.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bio</label>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                  value={form.bio}
                  placeholder="Trainer background and expertise"
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                />
              </div>

              {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
            </div>

            <SheetFooter className="p-0 pt-4 sm:justify-end sm:border-0">
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
                <p className="text-sm text-emerald-700">Details captured. Click Create Trainer to finish setup.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Trainer:</span> {form.fullName.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Employee Code:</span> {form.employeeCode.trim().toUpperCase()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email:</span> {form.email.trim().toLowerCase()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Specialization:</span> {form.specialization.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Courses:</span> {selectedCourseNames.join(", ")}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Status:</span> {form.status}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Availability:</span> {TRAINER_AVAILABILITY_LABELS[form.availabilityStatus]}
              </p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Trainer"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Trainer Created</p>
                <p className="text-sm text-blue-700">{form.fullName.trim()} has been added successfully.</p>
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
