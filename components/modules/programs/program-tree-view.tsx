"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, MessageCircle, UserCog, Users } from "lucide-react";

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

type BuddyPersonaItem = {
  id: string;
  name: string;
  language: string;
  description: string | null;
  isActive: boolean;
  welcomeMessage: string | null;
};

type BuddyPersonaApiItem = {
  id: string;
  name: string;
  language: string;
  description: string | null;
  isActive: boolean;
  welcomeMessage: string | null;
  assignedCourses?: { courseId: string; courseName: string }[];
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number): { date: Date; key: string; inMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0 ... Sunday = 6
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: { date: Date; key: string; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, key: toDateKey(d), inMonth: false });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, key: toDateKey(date), inMonth: true });
  }

  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, key: toDateKey(d), inMonth: false });
  }

  return days;
}

function groupEventsByDate(events: ScheduleEventItem[]): Record<string, ScheduleEventItem[]> {
  const map: Record<string, ScheduleEventItem[]> = {};
  for (const event of events) {
    const key = toDateKey(new Date(event.startsAt));
    if (!map[key]) map[key] = [];
    map[key].push(event);
  }
  return map;
}

function MiniCalendar({ events, batchId }: { events: ScheduleEventItem[]; batchId: string }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getMonthDays(year, month);
  const eventsByDate = groupEventsByDate(events);
  const todayKey = toDateKey(new Date());

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  return (
    <div>
      {/* Month header */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-lg p-1 hover:bg-indigo-100">
          <ChevronLeft className="h-3.5 w-3.5 text-indigo-700" />
        </button>
        <span className="text-xs font-bold text-indigo-900">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button type="button" onClick={nextMonth} className="rounded-lg p-1 hover:bg-indigo-100">
          <ChevronRight className="h-3.5 w-3.5 text-indigo-700" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAY_LABELS.map((wd) => (
          <div key={wd} className="py-1 text-[10px] font-semibold text-indigo-600">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const dayEvents = eventsByDate[day.key] ?? [];
          const hasClass = dayEvents.some((e) => e.type === "CLASS");
          const hasTest = dayEvents.some((e) => e.type === "TEST");
          const isSelected = selectedDay === day.key;
          const isToday = day.key === todayKey;

          return (
            <button
              key={`${batchId}-${day.key}`}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : day.key)}
              className={cn(
                "relative flex h-7 w-full flex-col items-center justify-center rounded-lg text-[10px] transition-colors",
                day.inMonth ? "text-slate-800" : "text-slate-300",
                isToday && "ring-1 ring-indigo-400",
                isSelected && "bg-indigo-200/60 font-bold",
                !isSelected && dayEvents.length > 0 && "hover:bg-indigo-100/60",
              )}
            >
              <span>{day.date.getDate()}</span>
              {(hasClass || hasTest) ? (
                <div className="flex gap-0.5">
                  {hasClass ? <span className="h-1 w-1 rounded-full bg-indigo-500" /> : null}
                  {hasTest ? <span className="h-1 w-1 rounded-full bg-rose-500" /> : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedEvents.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
            {new Date(selectedDay + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>
          {selectedEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-indigo-100 bg-white px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-800">{event.title}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", event.type === "TEST" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-indigo-200 bg-indigo-50 text-indigo-700")}>{event.type}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="text-[10px] text-slate-500">
                  {new Date(event.startsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
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
      ) : null}

      {selectedDay && selectedEvents.length === 0 ? (
        <p className="mt-3 text-[10px] text-indigo-600">No events on this day.</p>
      ) : null}

      {/* Legend */}
      {events.length > 0 ? (
        <div className="mt-3 flex items-center gap-3 border-t border-indigo-100 pt-2">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span className="text-[10px] text-slate-500">Class</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span className="text-[10px] text-slate-500">Test</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const [batchBuddy, setBatchBuddy] = useState<Record<string, BuddyPersonaItem | null>>({});
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
      const params = new URLSearchParams({ contextType: "batch", batchId, page: "1", pageSize: "100" });
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

  const toggleBuddy = async (batchId: string, courseId: string) => {
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
      const response = await fetch(`/api/language-lab/buddy-personas?isActive=true`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load buddy personas.");
      const payload = (await response.json()) as { data?: BuddyPersonaApiItem[] };
      const personas = payload.data ?? [];

      const matched = personas.find((p) => p.assignedCourses?.some((c) => c.courseId === courseId)) ?? null;

      setBatchBuddy((prev) => ({
        ...prev,
        [batchId]: matched
          ? { id: matched.id, name: matched.name, language: matched.language, description: matched.description, isActive: matched.isActive, welcomeMessage: matched.welcomeMessage }
          : null,
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
                                    const currentBuddyData = batchBuddy[batch.id] ?? undefined;
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

                                          {/* Schedule (Calendar) */}
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
                                                    <MiniCalendar events={currentSchedule} batchId={batch.id} />
                                                  ) : (
                                                    <p className="text-xs text-indigo-700">No schedule events found.</p>
                                                  )
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* Buddy (Course Persona) */}
                                          <div className="rounded-2xl border border-violet-200 bg-violet-50/70">
                                            <button type="button" onClick={() => void toggleBuddy(batch.id, program.courseId)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                                              <div className="flex items-center gap-2">
                                                <MessageCircle className="h-4 w-4 text-violet-700" />
                                                <span className="text-sm font-semibold text-violet-900">Buddy</span>
                                              </div>
                                              <ChevronDown className={cn("h-4 w-4 text-violet-700 transition-transform", !buddyOpen && "-rotate-90")} />
                                            </button>
                                            {buddyOpen ? (
                                              <div className="border-t border-violet-200/70 px-4 pb-4 pt-3">
                                                {isBuddyLoading ? <p className="text-xs text-violet-700">Loading buddy...</p> : null}
                                                {currentBuddyError ? <p className="text-xs text-rose-600">{currentBuddyError}</p> : null}
                                                {!isBuddyLoading && !currentBuddyError && currentBuddyData ? (
                                                  <div className="rounded-xl border border-violet-100 bg-white px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-sm font-bold text-slate-900">{currentBuddyData.name}</span>
                                                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{currentBuddyData.language}</span>
                                                    </div>
                                                    {currentBuddyData.description ? (
                                                      <p className="mt-1.5 text-xs text-slate-600">{currentBuddyData.description}</p>
                                                    ) : null}
                                                    {currentBuddyData.welcomeMessage ? (
                                                      <p className="mt-2 rounded-lg bg-violet-50/60 px-3 py-2 text-[11px] italic text-violet-800">
                                                        &ldquo;{currentBuddyData.welcomeMessage.length > 120 ? `${currentBuddyData.welcomeMessage.slice(0, 120)}…` : currentBuddyData.welcomeMessage}&rdquo;
                                                      </p>
                                                    ) : null}
                                                  </div>
                                                ) : null}
                                                {!isBuddyLoading && !currentBuddyError && currentBuddyData === null ? (
                                                  <p className="text-xs text-violet-700">No buddy assigned to this course.</p>
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
