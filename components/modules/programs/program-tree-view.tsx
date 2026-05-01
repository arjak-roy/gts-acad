"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, ChevronDown, ChevronRight, ClipboardList, GraduationCap, MessageCircle, UserCog, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programCount: number;
};

type ProgramType = "LANGUAGE" | "CLINICAL" | "TECHNICAL";

type ProgramOption = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: string;
  trainerNames: string[];
};

type LearnerItem = {
  id: string;
  learnerCode: string;
  fullName: string;
};

type LearnersResponse = {
  items: LearnerItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type BatchAssessmentItem = {
  assessmentPoolId: string;
  assessmentTitle: string;
  assessmentCode: string;
  questionType: string;
  difficultyLevel: string;
  status: string;
  questionCount: number;
  totalMarks: number;
  timeLimitMinutes: number | null;
  scheduledAt: string | null;
};

type ScheduleEventItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  sessionType: string | null;
  location: string | null;
};

type BuddySummary = {
  pronunciationAttempts: number;
  pronunciationAvgScore: number | null;
  uniquePronunciationLearners: number;
  roleplaySessions: number;
  roleplayCompletionRate: number;
  uniqueRoleplayLearners: number;
};

const PROGRAM_TYPE_COLORS: Record<ProgramType, string> = {
  LANGUAGE: "bg-violet-50 text-violet-700 border-violet-200",
  CLINICAL: "bg-rose-50 text-rose-700 border-rose-200",
  TECHNICAL: "bg-sky-50 text-sky-700 border-sky-200",
};

const BATCH_STATUS_COLORS: Record<string, string> = {
  IN_SESSION: "bg-green-50 text-green-700 border-green-200",
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-slate-50 text-slate-600 border-slate-200",
  DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ARCHIVED: "bg-slate-50 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function ExpandableRow({
  icon,
  title,
  meta,
  subtitle,
  accentClass,
  isOpen,
  isLoading,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  subtitle?: string;
  accentClass: string;
  isOpen: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", accentClass)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{title}</span>
          {meta ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{meta}</span> : null}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {isLoading ? <span className="text-xs text-slate-400">Loading...</span> : <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-90")} />}
    </button>
  );
}

export function ProgramTreeView() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [coursePrograms, setCoursePrograms] = useState<Record<string, ProgramOption[]>>({});
  const [loadingPrograms, setLoadingPrograms] = useState<Record<string, boolean>>({});
  const [programsError, setProgramsError] = useState<Record<string, string | null>>({});

  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [programBatches, setProgramBatches] = useState<Record<string, BatchOption[]>>({});
  const [loadingBatches, setLoadingBatches] = useState<Record<string, boolean>>({});
  const [batchesError, setBatchesError] = useState<Record<string, string | null>>({});

  const [expandedTrainers, setExpandedTrainers] = useState<Set<string>>(new Set());
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [batchStudents, setBatchStudents] = useState<Record<string, LearnerItem[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<Record<string, boolean>>({});
  const [studentsError, setStudentsError] = useState<Record<string, string | null>>({});
  const [studentsCounts, setStudentsCounts] = useState<Record<string, number>>({});

  const [expandedAssessments, setExpandedAssessments] = useState<Set<string>>(new Set());
  const [batchAssessments, setBatchAssessments] = useState<Record<string, BatchAssessmentItem[]>>({});
  const [loadingAssessments, setLoadingAssessments] = useState<Record<string, boolean>>({});
  const [assessmentsError, setAssessmentsError] = useState<Record<string, string | null>>({});

  const [expandedSchedule, setExpandedSchedule] = useState<Set<string>>(new Set());
  const [batchSchedule, setBatchSchedule] = useState<Record<string, ScheduleEventItem[]>>({});
  const [loadingSchedule, setLoadingSchedule] = useState<Record<string, boolean>>({});
  const [scheduleError, setScheduleError] = useState<Record<string, string | null>>({});

  const [expandedBuddy, setExpandedBuddy] = useState<Set<string>>(new Set());
  const [batchBuddy, setBatchBuddy] = useState<Record<string, BuddySummary>>({});
  const [loadingBuddy, setLoadingBuddy] = useState<Record<string, boolean>>({});
  const [buddyError, setBuddyError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load courses.");
        }

        const payload = (await response.json()) as { data?: CourseOption[] };
        if (!cancelled) {
          setCourses(payload.data ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCoursesError(loadError instanceof Error ? loadError.message : "Failed to load courses.");
        }
      } finally {
        if (!cancelled) {
          setLoadingCourses(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCourse = async (courseId: string) => {
    const isExpanding = !expandedCourses.has(courseId);

    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (isExpanding) {
        next.add(courseId);
      } else {
        next.delete(courseId);
      }
      return next;
    });

    if (!isExpanding || coursePrograms[courseId] !== undefined) {
      return;
    }

    setLoadingPrograms((prev) => ({ ...prev, [courseId]: true }));
    setProgramsError((prev) => ({ ...prev, [courseId]: null }));

    try {
      const response = await fetch(`/api/programs?courseId=${courseId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load programs.");
      }

      const payload = (await response.json()) as { data?: ProgramOption[] };
      setCoursePrograms((prev) => ({ ...prev, [courseId]: payload.data ?? [] }));
    } catch (loadError) {
      setProgramsError((prev) => ({
        ...prev,
        [courseId]: loadError instanceof Error ? loadError.message : "Failed to load programs.",
      }));
    } finally {
      setLoadingPrograms((prev) => ({ ...prev, [courseId]: false }));
    }
  };

  const toggleProgram = async (programId: string) => {
    const isExpanding = !expandedPrograms.has(programId);

    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (isExpanding) {
        next.add(programId);
      } else {
        next.delete(programId);
      }
      return next;
    });

    if (!isExpanding || programBatches[programId] !== undefined) {
      return;
    }

    setLoadingBatches((prev) => ({ ...prev, [programId]: true }));
    setBatchesError((prev) => ({ ...prev, [programId]: null }));

    try {
      const response = await fetch(`/api/programs/${programId}/batches`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load batches.");
      }

      const payload = (await response.json()) as { data?: BatchOption[] };
      setProgramBatches((prev) => ({ ...prev, [programId]: payload.data ?? [] }));
    } catch (loadError) {
      setBatchesError((prev) => ({
        ...prev,
        [programId]: loadError instanceof Error ? loadError.message : "Failed to load batches.",
      }));
    } finally {
      setLoadingBatches((prev) => ({ ...prev, [programId]: false }));
    }
  };

  const toggleTrainers = (batchId: string) => {
    setExpandedTrainers((prev) => {
      const next = new Set(prev);
      if (prev.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const toggleStudents = async (batchCode: string) => {
    const isExpanding = !expandedStudents.has(batchCode);

    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (isExpanding) {
        next.add(batchCode);
      } else {
        next.delete(batchCode);
      }
      return next;
    });

    if (!isExpanding || batchStudents[batchCode] !== undefined) {
      return;
    }

    setLoadingStudents((prev) => ({ ...prev, [batchCode]: true }));
    setStudentsError((prev) => ({ ...prev, [batchCode]: null }));

    try {
      const params = new URLSearchParams({
        batchCode,
        page: "1",
        pageSize: "50",
        sortBy: "fullName",
        sortDirection: "asc",
      });

      const response = await fetch(`/api/learners?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load students.");
      }

      const payload = (await response.json()) as { data?: LearnersResponse };
      setBatchStudents((prev) => ({ ...prev, [batchCode]: payload.data?.items ?? [] }));
      setStudentsCounts((prev) => ({ ...prev, [batchCode]: payload.data?.totalCount ?? 0 }));
    } catch (loadError) {
      setStudentsError((prev) => ({
        ...prev,
        [batchCode]: loadError instanceof Error ? loadError.message : "Failed to load students.",
      }));
    } finally {
      setLoadingStudents((prev) => ({ ...prev, [batchCode]: false }));
    }
  };

  const toggleAssessments = async (batchId: string) => {
    const isExpanding = !expandedAssessments.has(batchId);

    setExpandedAssessments((prev) => {
      const next = new Set(prev);
      if (isExpanding) next.add(batchId);
      else next.delete(batchId);
      return next;
    });

    if (!isExpanding || batchAssessments[batchId] !== undefined) return;

    setLoadingAssessments((prev) => ({ ...prev, [batchId]: true }));
    setAssessmentsError((prev) => ({ ...prev, [batchId]: null }));

    try {
      const response = await fetch(`/api/batch-content?batchId=${batchId}&type=assessment`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load assessments.");
      const payload = (await response.json()) as { data?: BatchAssessmentItem[] };
      setBatchAssessments((prev) => ({ ...prev, [batchId]: payload.data ?? [] }));
    } catch (loadError) {
      setAssessmentsError((prev) => ({
        ...prev,
        [batchId]: loadError instanceof Error ? loadError.message : "Failed to load assessments.",
      }));
    } finally {
      setLoadingAssessments((prev) => ({ ...prev, [batchId]: false }));
    }
  };

  const toggleSchedule = async (batchId: string) => {
    const isExpanding = !expandedSchedule.has(batchId);

    setExpandedSchedule((prev) => {
      const next = new Set(prev);
      if (isExpanding) next.add(batchId);
      else next.delete(batchId);
      return next;
    });

    if (!isExpanding || batchSchedule[batchId] !== undefined) return;

    setLoadingSchedule((prev) => ({ ...prev, [batchId]: true }));
    setScheduleError((prev) => ({ ...prev, [batchId]: null }));

    try {
      const params = new URLSearchParams({ contextType: "batch", batchId, page: "1", pageSize: "20" });
      const response = await fetch(`/api/schedule?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load schedule.");
      const payload = (await response.json()) as { data?: { items?: ScheduleEventItem[] } };
      setBatchSchedule((prev) => ({ ...prev, [batchId]: payload.data?.items ?? [] }));
    } catch (loadError) {
      setScheduleError((prev) => ({
        ...prev,
        [batchId]: loadError instanceof Error ? loadError.message : "Failed to load schedule.",
      }));
    } finally {
      setLoadingSchedule((prev) => ({ ...prev, [batchId]: false }));
    }
  };

  const toggleBuddy = async (batchId: string) => {
    const isExpanding = !expandedBuddy.has(batchId);

    setExpandedBuddy((prev) => {
      const next = new Set(prev);
      if (isExpanding) next.add(batchId);
      else next.delete(batchId);
      return next;
    });

    if (!isExpanding || batchBuddy[batchId] !== undefined) return;

    setLoadingBuddy((prev) => ({ ...prev, [batchId]: true }));
    setBuddyError((prev) => ({ ...prev, [batchId]: null }));

    try {
      const [pronRes, rpRes] = await Promise.all([
        fetch(`/api/language-lab/analytics/pronunciation?batchId=${batchId}`, { cache: "no-store" }),
        fetch(`/api/language-lab/analytics/roleplay?batchId=${batchId}`, { cache: "no-store" }),
      ]);

      const pronData = pronRes.ok ? ((await pronRes.json()) as { data?: { overview?: { totalAttempts?: number; averageScore?: number | null; uniqueLearnersCount?: number } } }).data?.overview : null;
      const rpData = rpRes.ok ? ((await rpRes.json()) as { data?: { overview?: { totalSessions?: number; completionRate?: number; uniqueLearnersCount?: number } } }).data?.overview : null;

      setBatchBuddy((prev) => ({
        ...prev,
        [batchId]: {
          pronunciationAttempts: pronData?.totalAttempts ?? 0,
          pronunciationAvgScore: pronData?.averageScore ?? null,
          uniquePronunciationLearners: pronData?.uniqueLearnersCount ?? 0,
          roleplaySessions: rpData?.totalSessions ?? 0,
          roleplayCompletionRate: rpData?.completionRate ?? 0,
          uniqueRoleplayLearners: rpData?.uniqueLearnersCount ?? 0,
        },
      }));
    } catch (loadError) {
      setBuddyError((prev) => ({
        ...prev,
        [batchId]: loadError instanceof Error ? loadError.message : "Failed to load buddy data.",
      }));
    } finally {
      setLoadingBuddy((prev) => ({ ...prev, [batchId]: false }));
    }
  };

  if (loadingCourses) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  if (coursesError) {
    return (
      <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-semibold text-rose-700">{coursesError}</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-[32px] border border-slate-100 bg-white p-10 text-center">
        <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">No courses found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {courses.map((course) => {
        const isCourseExpanded = expandedCourses.has(course.id);
        const isProgramLoading = !!loadingPrograms[course.id];
        const programs = coursePrograms[course.id] ?? [];
        const currentProgramsError = programsError[course.id] ?? null;

        return (
          <div key={course.id} className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
            <ExpandableRow
              icon={<BookOpen className="h-4 w-4 text-amber-700" />}
              title={course.name}
              meta={`${course.programCount} programs`}
              subtitle={course.description ?? "No description provided."}
              accentClass="bg-amber-50 border-amber-200"
              isOpen={isCourseExpanded}
              isLoading={isProgramLoading}
              onToggle={() => void toggleCourse(course.id)}
            />

            {isCourseExpanded ? (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-4">
                {isProgramLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : null}

                {currentProgramsError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{currentProgramsError}</p> : null}

                {!isProgramLoading && !currentProgramsError && programs.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">No programs mapped to this course yet.</p> : null}

                {!isProgramLoading && !currentProgramsError && programs.length > 0 ? (
                  <div className="space-y-4">
                    {programs.map((program) => {
                      const isBatchExpanded = expandedPrograms.has(program.id);
                      const isBatchLoading = !!loadingBatches[program.id];
                      const batches = programBatches[program.id] ?? [];
                      const currentBatchError = batchesError[program.id] ?? null;

                      return (
                        <div key={program.id} className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
                          <ExpandableRow
                            icon={<GraduationCap className="h-4 w-4" />}
                            title={program.name}
                            meta={program.type}
                            subtitle={program.isActive ? "Active program" : "Inactive program"}
                            accentClass={PROGRAM_TYPE_COLORS[program.type]}
                            isOpen={isBatchExpanded}
                            isLoading={isBatchLoading}
                            onToggle={() => void toggleProgram(program.id)}
                          />

                          {isBatchExpanded ? (
                            <div className="border-t border-slate-100 bg-slate-50/60 px-5 pb-5 pt-4">
                              {isBatchLoading ? (
                                <div className="space-y-3">
                                  {Array.from({ length: 2 }).map((_, index) => (
                                    <Skeleton key={index} className="h-32 w-full rounded-2xl" />
                                  ))}
                                </div>
                              ) : null}

                              {currentBatchError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{currentBatchError}</p> : null}

                              {!isBatchLoading && !currentBatchError && batches.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">No batches under this program.</p> : null}

                              {!isBatchLoading && !currentBatchError && batches.length > 0 ? (
                                <div className="space-y-4">
                                  {batches.map((batch) => {
                                    const trainersOpen = expandedTrainers.has(batch.id);
                                    const studentsOpen = expandedStudents.has(batch.code);
                                    const isStudentsLoading = !!loadingStudents[batch.code];
                                    const currentStudents = batchStudents[batch.code] ?? [];
                                    const currentStudentsError = studentsError[batch.code] ?? null;
                                    const currentStudentCount = studentsCounts[batch.code] ?? 0;

                                    const assessmentsOpen = expandedAssessments.has(batch.id);
                                    const isAssessmentsLoading = !!loadingAssessments[batch.id];
                                    const currentAssessments = batchAssessments[batch.id] ?? [];
                                    const currentAssessmentsError = assessmentsError[batch.id] ?? null;

                                    const scheduleOpen = expandedSchedule.has(batch.id);
                                    const isScheduleLoading = !!loadingSchedule[batch.id];
                                    const currentSchedule = batchSchedule[batch.id] ?? [];
                                    const currentScheduleError = scheduleError[batch.id] ?? null;

                                    const buddyOpen = expandedBuddy.has(batch.id);
                                    const isBuddyLoading = !!loadingBuddy[batch.id];
                                    const currentBuddyData = batchBuddy[batch.id] ?? null;
                                    const currentBuddyError = buddyError[batch.id] ?? null;

                                    return (
                                      <div key={batch.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="text-sm font-semibold text-slate-900">{batch.code}</p>
                                              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", BATCH_STATUS_COLORS[batch.status] ?? "border-slate-200 bg-slate-50 text-slate-500")}>{batch.status}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{batch.name}</p>
                                            <p className="mt-1 text-xs text-slate-400">{batch.campus ?? "Campus not set"}</p>
                                          </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                          {/* Trainers */}
                                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70">
                                            <button type="button" onClick={() => toggleTrainers(batch.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                                              <div className="flex items-center gap-2">
                                                <UserCog className="h-4 w-4 text-emerald-700" />
                                                <span className="text-sm font-semibold text-emerald-900">Trainers</span>
                                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-emerald-700">{batch.trainerNames.length}</span>
                                              </div>
                                              <ChevronDown className={cn("h-4 w-4 text-emerald-700 transition-transform", !trainersOpen && "-rotate-90")} />
                                            </button>
                                            {trainersOpen ? (
                                              <div className="border-t border-emerald-200/70 px-4 pb-4 pt-3">
                                                {batch.trainerNames.length > 0 ? (
                                                  <div className="flex flex-wrap gap-2">
                                                    {batch.trainerNames.map((trainerName) => (
                                                      <span key={trainerName} className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                                                        {trainerName}
                                                      </span>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="text-xs text-emerald-700">No trainers assigned.</p>
                                                )}
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* Students */}
                                          <div className="rounded-2xl border border-sky-200 bg-sky-50/70">
                                            <button type="button" onClick={() => void toggleStudents(batch.code)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                                              <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-sky-700" />
                                                <span className="text-sm font-semibold text-sky-900">Students</span>
                                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-sky-700">{currentStudentCount}</span>
                                              </div>
                                              <ChevronDown className={cn("h-4 w-4 text-sky-700 transition-transform", !studentsOpen && "-rotate-90")} />
                                            </button>
                                            {studentsOpen ? (
                                              <div className="border-t border-sky-200/70 px-4 pb-4 pt-3">
                                                {isStudentsLoading ? <p className="text-xs text-sky-700">Loading students...</p> : null}
                                                {currentStudentsError ? <p className="text-xs text-rose-600">{currentStudentsError}</p> : null}
                                                {!isStudentsLoading && !currentStudentsError ? (
                                                  currentStudents.length > 0 ? (
                                                    <div className="space-y-2">
                                                      {currentStudents.map((student) => (
                                                        <div key={student.id} className="flex items-center justify-between rounded-xl border border-sky-100 bg-white px-3 py-2">
                                                          <span className="text-xs font-medium text-slate-800">{student.fullName}</span>
                                                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{student.learnerCode}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-xs text-sky-700">No students found in this batch.</p>
                                                  )
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* Assessments */}
                                          <div className="rounded-2xl border border-amber-200 bg-amber-50/70">
                                            <button type="button" onClick={() => void toggleAssessments(batch.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                                              <div className="flex items-center gap-2">
                                                <ClipboardList className="h-4 w-4 text-amber-700" />
                                                <span className="text-sm font-semibold text-amber-900">Assessments</span>
                                                {batchAssessments[batch.id] !== undefined ? (
                                                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-amber-700">{currentAssessments.length}</span>
                                                ) : null}
                                              </div>
                                              <ChevronDown className={cn("h-4 w-4 text-amber-700 transition-transform", !assessmentsOpen && "-rotate-90")} />
                                            </button>
                                            {assessmentsOpen ? (
                                              <div className="border-t border-amber-200/70 px-4 pb-4 pt-3">
                                                {isAssessmentsLoading ? <p className="text-xs text-amber-700">Loading assessments...</p> : null}
                                                {currentAssessmentsError ? <p className="text-xs text-rose-600">{currentAssessmentsError}</p> : null}
                                                {!isAssessmentsLoading && !currentAssessmentsError ? (
                                                  currentAssessments.length > 0 ? (
                                                    <div className="space-y-2">
                                                      {currentAssessments.map((assessment) => (
                                                        <div key={assessment.assessmentPoolId} className="rounded-xl border border-amber-100 bg-white px-3 py-2">
                                                          <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium text-slate-800">{assessment.assessmentTitle}</span>
                                                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{assessment.assessmentCode}</span>
                                                          </div>
                                                          <div className="mt-1 flex flex-wrap gap-2">
                                                            <span className="text-[10px] text-slate-500">{assessment.questionType?.replace(/_/g, " ")}</span>
                                                            <span className="text-[10px] text-slate-400">•</span>
                                                            <span className="text-[10px] text-slate-500">{assessment.questionCount} Q</span>
                                                            <span className="text-[10px] text-slate-400">•</span>
                                                            <span className="text-[10px] text-slate-500">{assessment.totalMarks} marks</span>
                                                            {assessment.timeLimitMinutes ? (
                                                              <>
                                                                <span className="text-[10px] text-slate-400">•</span>
                                                                <span className="text-[10px] text-slate-500">{assessment.timeLimitMinutes} min</span>
                                                              </>
                                                            ) : null}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-xs text-amber-700">No assessments assigned.</p>
                                                  )
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* Schedule */}
                                          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70">
                                            <button type="button" onClick={() => void toggleSchedule(batch.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                                              <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-indigo-700" />
                                                <span className="text-sm font-semibold text-indigo-900">Schedule</span>
                                                {batchSchedule[batch.id] !== undefined ? (
                                                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-indigo-700">{currentSchedule.length}</span>
                                                ) : null}
                                              </div>
                                              <ChevronDown className={cn("h-4 w-4 text-indigo-700 transition-transform", !scheduleOpen && "-rotate-90")} />
                                            </button>
                                            {scheduleOpen ? (
                                              <div className="border-t border-indigo-200/70 px-4 pb-4 pt-3">
                                                {isScheduleLoading ? <p className="text-xs text-indigo-700">Loading schedule...</p> : null}
                                                {currentScheduleError ? <p className="text-xs text-rose-600">{currentScheduleError}</p> : null}
                                                {!isScheduleLoading && !currentScheduleError ? (
                                                  currentSchedule.length > 0 ? (
                                                    <div className="space-y-2">
                                                      {currentSchedule.map((event) => (
                                                        <div key={event.id} className="rounded-xl border border-indigo-100 bg-white px-3 py-2">
                                                          <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium text-slate-800">{event.title}</span>
                                                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", event.type === "TEST" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-indigo-200 bg-indigo-50 text-indigo-700")}>{event.type}</span>
                                                          </div>
                                                          <div className="mt-1 flex flex-wrap gap-2">
                                                            <span className="text-[10px] text-slate-500">
                                                              {new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                            {event.sessionType ? (
                                                              <>
                                                                <span className="text-[10px] text-slate-400">•</span>
                                                                <span className="text-[10px] text-slate-500">{event.sessionType.replace(/_/g, " ")}</span>
                                                              </>
                                                            ) : null}
                                                            {event.location ? (
                                                              <>
                                                                <span className="text-[10px] text-slate-400">•</span>
                                                                <span className="text-[10px] text-slate-500">{event.location}</span>
                                                              </>
                                                            ) : null}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-xs text-indigo-700">No schedule events found.</p>
                                                  )
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* Buddy (Language Lab) */}
                                          <div className="rounded-2xl border border-violet-200 bg-violet-50/70">
                                            <button type="button" onClick={() => void toggleBuddy(batch.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                                              <div className="flex items-center gap-2">
                                                <MessageCircle className="h-4 w-4 text-violet-700" />
                                                <span className="text-sm font-semibold text-violet-900">Buddy</span>
                                              </div>
                                              <ChevronDown className={cn("h-4 w-4 text-violet-700 transition-transform", !buddyOpen && "-rotate-90")} />
                                            </button>
                                            {buddyOpen ? (
                                              <div className="border-t border-violet-200/70 px-4 pb-4 pt-3">
                                                {isBuddyLoading ? <p className="text-xs text-violet-700">Loading buddy data...</p> : null}
                                                {currentBuddyError ? <p className="text-xs text-rose-600">{currentBuddyError}</p> : null}
                                                {!isBuddyLoading && !currentBuddyError && currentBuddyData ? (
                                                  <div className="grid grid-cols-2 gap-3">
                                                    <div className="rounded-xl border border-violet-100 bg-white px-3 py-2">
                                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Pronunciation</p>
                                                      <p className="mt-0.5 text-sm font-bold text-slate-900">{currentBuddyData.pronunciationAttempts} attempts</p>
                                                      <p className="text-[10px] text-slate-500">
                                                        Avg score: {currentBuddyData.pronunciationAvgScore != null ? `${Math.round(currentBuddyData.pronunciationAvgScore)}%` : "—"}
                                                      </p>
                                                      <p className="text-[10px] text-slate-500">{currentBuddyData.uniquePronunciationLearners} learners</p>
                                                    </div>
                                                    <div className="rounded-xl border border-violet-100 bg-white px-3 py-2">
                                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Roleplay</p>
                                                      <p className="mt-0.5 text-sm font-bold text-slate-900">{currentBuddyData.roleplaySessions} sessions</p>
                                                      <p className="text-[10px] text-slate-500">
                                                        Completion: {Math.round(currentBuddyData.roleplayCompletionRate)}%
                                                      </p>
                                                      <p className="text-[10px] text-slate-500">{currentBuddyData.uniqueRoleplayLearners} learners</p>
                                                    </div>
                                                  </div>
                                                ) : null}
                                                {!isBuddyLoading && !currentBuddyError && !currentBuddyData ? (
                                                  <p className="text-xs text-violet-700">No buddy activity data.</p>
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}