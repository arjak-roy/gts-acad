"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ProgramOption = {
  id: string;
  courseId: string;
  courseName: string;
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

export type CandidateEnrollmentPathValue = {
  courseId: string;
  programId: string;
  batchCode: string;
};

export type CandidateCourseSelection = {
  id: string;
  name: string;
};

export type CandidateProgramSelection = {
  id: string;
  name: string;
  type: ProgramOption["type"];
};

export type CandidateBatchSelection = {
  code: string;
  name: string;
  campus: string | null;
};

type CandidateEnrollmentPathFieldsProps = {
  open: boolean;
  value: CandidateEnrollmentPathValue;
  onCourseChange: (course: CandidateCourseSelection | null) => void;
  onProgramChange: (program: CandidateProgramSelection | null) => void;
  onBatchChange: (batch: CandidateBatchSelection | null) => void;
};

function StepCard({
  step,
  title,
  description,
  disabled,
  children,
}: {
  step: string;
  title: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        disabled ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-200 bg-white",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{step}</p>
      <div className="mt-2 space-y-1.5">
        <div>
          <p className={cn("text-sm font-semibold", disabled ? "text-slate-400" : "text-slate-900")}>{title}</p>
          <p className={cn("text-xs", disabled ? "text-slate-400" : "text-slate-500")}>{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CandidateEnrollmentPathFields({
  open,
  value,
  onCourseChange,
  onProgramChange,
  onBatchChange,
}: CandidateEnrollmentPathFieldsProps) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadCourses = async () => {
      setIsLoadingCourses(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load courses.");
        }

        const payload = (await response.json()) as { data?: CourseOption[] };
        if (!active) {
          return;
        }

        setCourses((payload.data ?? []).filter((course) => course.isActive));
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Failed to load courses.");
        setCourses([]);
      } finally {
        if (active) {
          setIsLoadingCourses(false);
        }
      }
    };

    void loadCourses();

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!value.courseId) {
      setPrograms([]);
      setBatches([]);
      setIsLoadingPrograms(false);
      setIsLoadingBatches(false);
      return;
    }

    let active = true;

    const loadPrograms = async () => {
      setIsLoadingPrograms(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({ courseId: value.courseId });
        const response = await fetch(`/api/programs?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load programs.");
        }

        const payload = (await response.json()) as { data?: ProgramOption[] };
        if (!active) {
          return;
        }

        setPrograms((payload.data ?? []).filter((program) => program.isActive));
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Failed to load programs.");
        setPrograms([]);
      } finally {
        if (active) {
          setIsLoadingPrograms(false);
        }
      }
    };

    void loadPrograms();

    return () => {
      active = false;
    };
  }, [open, value.courseId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!value.programId) {
      setBatches([]);
      setIsLoadingBatches(false);
      return;
    }

    let active = true;

    const loadBatches = async () => {
      setIsLoadingBatches(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/programs/${value.programId}/batches`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load batches.");
        }

        const payload = (await response.json()) as { data?: BatchOption[] };
        if (!active) {
          return;
        }

        setBatches(
          (payload.data ?? []).filter((batch) => batch.status === "PLANNED" || batch.status === "IN_SESSION"),
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Failed to load batches.");
        setBatches([]);
      } finally {
        if (active) {
          setIsLoadingBatches(false);
        }
      }
    };

    void loadBatches();

    return () => {
      active = false;
    };
  }, [open, value.programId]);

  const handleCourseChange = (nextCourseId: string) => {
    const course = courses.find((candidate) => candidate.id === nextCourseId) ?? null;
    onCourseChange(course ? { id: course.id, name: course.name } : null);
    onProgramChange(null);
    onBatchChange(null);
  };

  const handleProgramChange = (nextProgramId: string) => {
    const program = programs.find((candidate) => candidate.id === nextProgramId) ?? null;
    onProgramChange(program ? { id: program.id, name: program.name, type: program.type } : null);
    onBatchChange(null);
  };

  const handleBatchChange = (nextBatchCode: string) => {
    const batch = batches.find((candidate) => candidate.code === nextBatchCode) ?? null;
    onBatchChange(batch ? { code: batch.code, name: batch.name, campus: batch.campus } : null);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Enrollment Path</p>
        <p className="mt-1 text-sm text-slate-500">Choose the course first, then narrow the candidate down to a program and active batch.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <StepCard step="Step 1" title="Course" description="Start with the top-level course.">
          <select
            className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
            value={value.courseId}
            onChange={(event) => handleCourseChange(event.target.value)}
            disabled={isLoadingCourses || courses.length === 0}
          >
            <option value="">
              {isLoadingCourses ? "Loading courses..." : courses.length === 0 ? "No courses available" : "Select a course"}
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </StepCard>

        <StepCard
          step="Step 2"
          title="Program"
          description="Programs are filtered by the selected course."
          disabled={!value.courseId}
        >
          <select
            className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
            value={value.programId}
            onChange={(event) => handleProgramChange(event.target.value)}
            disabled={!value.courseId || isLoadingPrograms || programs.length === 0}
          >
            <option value="">
              {!value.courseId
                ? "Select a course first"
                : isLoadingPrograms
                  ? "Loading programs..."
                  : programs.length === 0
                    ? "No programs available"
                    : "Select a program"}
            </option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.type})
              </option>
            ))}
          </select>
        </StepCard>

        <StepCard
          step="Step 3"
          title="Batch"
          description="Only planned and in-session batches are shown."
          disabled={!value.programId}
        >
          <select
            className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
            value={value.batchCode}
            onChange={(event) => handleBatchChange(event.target.value)}
            disabled={!value.programId || isLoadingBatches || batches.length === 0}
          >
            <option value="">
              {!value.programId
                ? "Select a program first"
                : isLoadingBatches
                  ? "Loading batches..."
                  : batches.length === 0
                    ? "No active batches available"
                    : "Select a batch"}
            </option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.code}>
                {batch.name} ({batch.code}){batch.campus ? ` - ${batch.campus}` : ""}
              </option>
            ))}
          </select>
        </StepCard>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{loadError}</p>
      ) : null}
    </div>
  );
}