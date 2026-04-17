"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, BookOpenText, CalendarCheck2, ClipboardList, GraduationCap, GripVertical, LayoutGrid, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getCourseStatusBadgeVariant } from "@/lib/course-status";
import { useRbac } from "@/lib/rbac-context";
import { cn, createSearchParams, formatCompactNumber } from "@/lib/utils";
import { CourseStatus, DashboardSearchResult, DashboardStats } from "@/types";
import { toast } from "sonner";

import { DashboardSearchResults } from "@/components/modules/dashboard/dashboard-search-results";
import { DashboardStageFunnel } from "@/components/modules/dashboard/readiness-funnel";
import { StatsGrid } from "@/components/modules/dashboard/stats-grid";

type DashboardCategoryFilterOption = {
  id: string;
  label: string;
};

type DashboardCourseFilterOption = {
  id: string;
  label: string;
  helper: string | null;
};

type DashboardProgramFilterOption = {
  id: string;
  courseId: string;
  type: DashboardStats["filters"]["programType"] | null;
  label: string;
  helper: string | null;
};

type DashboardBatchFilterOption = {
  id: string;
  courseId: string | null;
  programId: string | null;
  programType: DashboardStats["filters"]["programType"] | null;
  label: string;
  helper: string | null;
};

type DashboardFilterDraft = {
  programType: string;
  courseId: string;
  programId: string;
  batchId: string;
};

type DashboardApiEnvelope<T> = {
  data?: T;
  error?: string;
};

const DASHBOARD_WIDGET_STORAGE_PREFIX = "gts-academy:dashboard-layout:v1";
const DASHBOARD_WIDGET_IDS = [
  "operations-snapshot",
  "course-status-overview",
  "readiness-funnel",
  "learner-progress-funnel",
  "pending-actions",
  "learner-progress",
  "learning-trendline",
  "recent-activity",
  "trainer-workload",
  "delivery-coverage",
  "quick-actions",
] as const;

type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

const DASHBOARD_WIDGET_SIZES = ["sm", "md", "lg", "full"] as const;
type DashboardWidgetSize = (typeof DASHBOARD_WIDGET_SIZES)[number];

function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return typeof value === "string" && (DASHBOARD_WIDGET_SIZES as readonly string[]).includes(value);
}

const WIDGET_SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  sm: "Small (1/3)",
  md: "Medium (1/2)",
  lg: "Large (2/3)",
  full: "Full Width",
};

const WIDGET_SIZE_SHORT_LABELS: Record<DashboardWidgetSize, string> = {
  sm: "S",
  md: "M",
  lg: "L",
  full: "F",
};

const WIDGET_SIZE_GRID_CLASSES: Record<DashboardWidgetSize, string> = {
  sm: "md:col-span-1 lg:col-span-2 xl:col-span-4",
  md: "md:col-span-1 lg:col-span-3 xl:col-span-6",
  lg: "md:col-span-2 lg:col-span-4 xl:col-span-8",
  full: "md:col-span-2 lg:col-span-6 xl:col-span-12",
};

type DashboardWidgetPreferences = {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
  sizes: Partial<Record<DashboardWidgetId, DashboardWidgetSize>>;
};

type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  title: string;
  description: string;
  defaultSize: DashboardWidgetSize;
  allowedSizes: DashboardWidgetSize[];
  content: ReactNode;
};

const DEFAULT_DASHBOARD_WIDGET_PREFERENCES: DashboardWidgetPreferences = {
  order: [...DASHBOARD_WIDGET_IDS],
  hidden: [],
  sizes: {},
};

function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && DASHBOARD_WIDGET_IDS.includes(value as DashboardWidgetId);
}

function sanitizeDashboardWidgetPreferences(value: unknown): DashboardWidgetPreferences {
  const parsed = typeof value === "object" && value !== null ? value as Partial<DashboardWidgetPreferences> : null;
  const requestedOrder = Array.isArray(parsed?.order) ? parsed.order.filter(isDashboardWidgetId) : [];
  const requestedHidden = Array.isArray(parsed?.hidden) ? parsed.hidden.filter(isDashboardWidgetId) : [];
  const orderSet = new Set(requestedOrder);
  const rawSizes = typeof parsed?.sizes === "object" && parsed.sizes !== null ? parsed.sizes : {};
  const sanitizedSizes: Partial<Record<DashboardWidgetId, DashboardWidgetSize>> = {};

  for (const [key, val] of Object.entries(rawSizes)) {
    if (isDashboardWidgetId(key) && isDashboardWidgetSize(val)) {
      sanitizedSizes[key] = val;
    }
  }

  return {
    order: [...requestedOrder, ...DASHBOARD_WIDGET_IDS.filter((widgetId) => !orderSet.has(widgetId))],
    hidden: Array.from(new Set(requestedHidden)),
    sizes: sanitizedSizes,
  };
}

function loadDashboardWidgetPreferences(storageKey: string) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return DEFAULT_DASHBOARD_WIDGET_PREFERENCES;
    }

    return sanitizeDashboardWidgetPreferences(JSON.parse(rawValue));
  } catch {
    return DEFAULT_DASHBOARD_WIDGET_PREFERENCES;
  }
}

function saveDashboardWidgetPreferences(storageKey: string, preferences: DashboardWidgetPreferences) {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

const READINESS_FUNNEL_STAGE_HELPERS: Record<string, string> = {
  "Total Enrolled": "All learners enrolled in the current dashboard scope.",
  "Active Learning": "Learners actively moving through live batches and content.",
  "Assessment Cleared": "Learners who already crossed the assessment threshold.",
  "Placement Ready": "Learners marked ready for placement handoff.",
};

function reorderVisibleWidgetIds(
  order: DashboardWidgetId[],
  hidden: DashboardWidgetId[],
  activeId: DashboardWidgetId,
  overId: DashboardWidgetId,
) {
  const hiddenSet = new Set(hidden);
  const visibleOrder = order.filter((widgetId) => !hiddenSet.has(widgetId));
  const activeIndex = visibleOrder.indexOf(activeId);
  const overIndex = visibleOrder.indexOf(overId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return order;
  }

  const reorderedVisible = arrayMove(visibleOrder, activeIndex, overIndex);
  const visibleQueue = [...reorderedVisible];

  return order.map((widgetId) => (hiddenSet.has(widgetId) ? widgetId : visibleQueue.shift() ?? widgetId));
}

function toDraftFilters(filters: DashboardStats["filters"]): DashboardFilterDraft {
  return {
    programType: filters.programType ?? "",
    courseId: filters.courseId ?? "",
    programId: filters.programId ?? "",
    batchId: filters.batchId ?? "",
  };
}

function sanitizeDraftFilters(
  filters: DashboardFilterDraft,
  filterOptions: {
    programs: DashboardProgramFilterOption[];
    batches: DashboardBatchFilterOption[];
  },
): DashboardFilterDraft {
  let nextProgramType = filters.programType;
  let nextCourseId = filters.courseId;
  let nextProgramId = filters.programId;
  let nextBatchId = filters.batchId;

  if (nextProgramId) {
    const selectedProgram = filterOptions.programs.find((program) => program.id === nextProgramId);

    if (
      !selectedProgram ||
      (nextCourseId && selectedProgram.courseId !== nextCourseId) ||
      (nextProgramType && selectedProgram.type && selectedProgram.type !== nextProgramType)
    ) {
      nextProgramId = "";
    } else if (!nextCourseId) {
      nextCourseId = selectedProgram.courseId;
      nextProgramType = selectedProgram.type ?? nextProgramType;
    }
  }

  if (nextBatchId) {
    const selectedBatch = filterOptions.batches.find((batch) => batch.id === nextBatchId);

    if (!selectedBatch) {
      nextBatchId = "";
    } else if (
      (nextProgramType && selectedBatch.programType && selectedBatch.programType !== nextProgramType) ||
      (nextCourseId && selectedBatch.courseId && selectedBatch.courseId !== nextCourseId) ||
      (nextProgramId && selectedBatch.programId && selectedBatch.programId !== nextProgramId)
    ) {
      nextBatchId = "";
    } else {
      nextProgramType = selectedBatch.programType ?? nextProgramType;
      nextCourseId = selectedBatch.courseId ?? nextCourseId;
      nextProgramId = selectedBatch.programId ?? nextProgramId;
    }
  }

  return {
    programType: nextProgramType,
    courseId: nextCourseId,
    programId: nextProgramId,
    batchId: nextBatchId,
  };
}

async function fetchDashboardStats(filters: DashboardFilterDraft): Promise<DashboardStats> {
  const queryString = createSearchParams({
    programType: filters.programType || null,
    courseId: filters.courseId || null,
    programId: filters.programId || null,
    batchId: filters.batchId || null,
  });
  const response = await fetch(queryString ? `/api/dashboard?${queryString}` : "/api/dashboard", {
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json()) as DashboardApiEnvelope<DashboardStats>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to refresh dashboard metrics.");
  }

  return payload.data;
}

function buildInsightSearchResult(stats: DashboardStats, query: string): DashboardSearchResult | null {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  const items = [
    { id: "total-courses", title: "Courses", description: `${stats.totalCourses.toLocaleString("en-IN")} | Total courses in the current scope` },
    { id: "published-courses", title: "Published Courses", description: `${stats.publishedCourses.toLocaleString("en-IN")} | Approved and live for delivery` },
    { id: "pending-course-approvals", title: "Approvals Queue", description: `${stats.pendingCourseApprovals.toLocaleString("en-IN")} | Courses waiting for review` },
    { id: "overdue-assignments", title: "Overdue Assignments", description: `${stats.overdueAssignments.toLocaleString("en-IN")} | Scheduled assessments that crossed their planned start time` },
    { id: "active-learners", title: "Active Learners", description: `${stats.activeLearners.toLocaleString("en-IN")} | Learners actively participating in scoped batches` },
    { id: "total-trainers", title: "Trainers", description: `${stats.totalTrainers.toLocaleString("en-IN")} | Trainers represented in the current scope` },
    { id: "quiz-pools", title: "Quiz Pools", description: `${stats.totalQuizzes.toLocaleString("en-IN")} | Reusable assessments available in scope` },
    { id: "required-completion", title: "Required Completion", description: `${stats.overallCompletionRate.toFixed(1)}% | Required item completion rate` },
    { id: "average-attendance", title: "Avg Attendance", description: `${stats.averageAttendance.toFixed(1)}% | Attendance health` },
    { id: "average-assessment-score", title: "Avg Assessment Score", description: `${stats.averageAssessmentScore.toFixed(1)}/100 | Assessment performance` },
    ...stats.courseStatusBreakdown.map((stage) => ({
      id: `status-${stage.status}`,
      title: formatDashboardCourseStatusLabel(stage),
      description: `${stage.value.toLocaleString("en-IN")} | Course lifecycle stage`,
    })),
    ...stats.pendingActions.map((item) => ({
      id: `pending-${item.id}`,
      title: item.title,
      description: `${item.count.toLocaleString("en-IN")} | ${item.detail}`,
    })),
    ...stats.trends.map((point) => ({
      id: `trend-${point.label}`,
      title: `${point.label} Trendline`,
      description: `${formatCompactNumber(point.startedLearners)} started | ${point.completedLearners} completed`,
    })),
  ]
    .filter(
      (item) => item.title.toLowerCase().includes(normalizedQuery) || item.description.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 6)
    .map((item) => ({
      ...item,
      href: "/dashboard",
      section: "insights" as const,
    }));

  if (items.length === 0) {
    return null;
  }

  return {
    query,
    total: items.length,
    groups: [
      {
        key: "insights",
        label: "Dashboard Insights",
        items,
      },
    ],
  };
}

function formatOccurredAt(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getToneClasses(tone: "default" | "info" | "warning" | "danger") {
  switch (tone) {
    case "danger":
      return "border-rose-100 bg-rose-50 text-rose-800";
    case "warning":
      return "border-amber-100 bg-amber-50 text-amber-800";
    case "info":
      return "border-blue-100 bg-blue-50 text-[#0d3b84]";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatDashboardCourseStatusLabel(point: DashboardStats["courseStatusBreakdown"][number]) {
  return point.status === CourseStatus.IN_REVIEW ? "Pending Approval" : point.label;
}

function getDashboardCourseStatusColor(status: DashboardStats["courseStatusBreakdown"][number]["status"]) {
  switch (status) {
    case CourseStatus.PUBLISHED:
      return "#10b981";
    case CourseStatus.IN_REVIEW:
      return "#f59e0b";
    case CourseStatus.ARCHIVED:
      return "#fb7185";
    default:
      return "#64748b";
  }
}

function CourseStatusDonut({
  points,
  totalCourses,
}: {
  points: DashboardStats["courseStatusBreakdown"];
  totalCourses: number;
}) {
  const radius = 56;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  let consumedLength = 0;

  const segments = points.map((point) => {
    const fraction = totalCourses > 0 ? point.value / totalCourses : 0;
    const segmentLength = fraction * circumference;
    const segment = {
      ...point,
      label: formatDashboardCourseStatusLabel(point),
      color: getDashboardCourseStatusColor(point.status),
      percentage: totalCourses > 0 ? Math.round(fraction * 100) : 0,
      strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
      strokeDashoffset: -consumedLength,
    };

    consumedLength += segmentLength;
    return segment;
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto">
        <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
            {segments.map((segment) =>
              segment.value > 0 ? (
                <circle
                  key={segment.status}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={segment.strokeDasharray}
                  strokeDashoffset={segment.strokeDashoffset}
                />
              ) : null,
            )}
          </svg>

          <div className="absolute text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total Courses</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{totalCourses.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.status} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                <Badge variant={getCourseStatusBadgeVariant(segment.status)}>{segment.label}</Badge>
              </div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{segment.percentage}%</p>
            </div>

            <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <p className="text-sm font-semibold text-slate-900">{segment.value.toLocaleString("en-IN")} course{segment.value === 1 ? "" : "s"}</p>
              <p className="text-sm text-slate-500">{segment.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetEmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-500">{message}</div>;
}

function DashboardSortableWidget({
  widget,
  currentSize,
  onResize,
}: {
  widget: DashboardWidgetDefinition;
  currentSize: DashboardWidgetSize;
  onResize: (size: DashboardWidgetSize) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(WIDGET_SIZE_GRID_CLASSES[currentSize], "relative transition-all duration-200")}>
      <Card className={cn("h-full overflow-hidden", isDragging && "shadow-xl ring-2 ring-[#0d3b84]/15")}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">{widget.title}</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6">{widget.description}</CardDescription>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:flex" role="group" aria-label={`Resize ${widget.title}`}>
                {widget.allowedSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onResize(size)}
                    aria-label={WIDGET_SIZE_LABELS[size]}
                    title={WIDGET_SIZE_LABELS[size]}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-black transition-all",
                      currentSize === size
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-400 hover:bg-white hover:text-slate-700",
                    )}
                  >
                    {WIDGET_SIZE_SHORT_LABELS[size]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label={`Reorder ${widget.title}`}
                className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700 active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">{widget.content}</CardContent>
      </Card>
    </div>
  );
}

export function DashboardOverview({
  stats,
  searchQuery,
  searchResults,
  filterOptions,
}: {
  stats: DashboardStats;
  searchQuery: string;
  searchResults: DashboardSearchResult | null;
  filterOptions: {
    categories: DashboardCategoryFilterOption[];
    courses: DashboardCourseFilterOption[];
    programs: DashboardProgramFilterOption[];
    batches: DashboardBatchFilterOption[];
  };
}) {
  const pathname = usePathname();
  const { user } = useRbac();
  const [statsState, setStatsState] = useState(stats);
  const [draftFilters, setDraftFilters] = useState<DashboardFilterDraft>(() => toDraftFilters(stats.filters));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [widgetPreferences, setWidgetPreferences] = useState<DashboardWidgetPreferences>(DEFAULT_DASHBOARD_WIDGET_PREFERENCES);
  const [hasLoadedWidgetPreferences, setHasLoadedWidgetPreferences] = useState(false);

  const widgetStorageKey = useMemo(
    () => (user?.email ? `${DASHBOARD_WIDGET_STORAGE_PREFIX}:${user.email.toLowerCase()}` : null),
    [user?.email],
  );
  const resolvedWidgetPreferences = useMemo(
    () => sanitizeDashboardWidgetPreferences(widgetPreferences),
    [widgetPreferences],
  );

  useEffect(() => {
    setStatsState(stats);
    setDraftFilters(toDraftFilters(stats.filters));
  }, [stats]);

  useEffect(() => {
    if (!widgetStorageKey) {
      setWidgetPreferences(DEFAULT_DASHBOARD_WIDGET_PREFERENCES);
      setHasLoadedWidgetPreferences(false);
      return;
    }

    setWidgetPreferences(loadDashboardWidgetPreferences(widgetStorageKey));
    setHasLoadedWidgetPreferences(true);
  }, [widgetStorageKey]);

  useEffect(() => {
    if (!widgetStorageKey || !hasLoadedWidgetPreferences) {
      return;
    }

    saveDashboardWidgetPreferences(widgetStorageKey, resolvedWidgetPreferences);
  }, [hasLoadedWidgetPreferences, resolvedWidgetPreferences, widgetStorageKey]);

  const visibleCourses = useMemo(() => {
    if (!draftFilters.programType) {
      return filterOptions.courses;
    }

    const visibleCourseIds = new Set(
      filterOptions.programs
        .filter((program) => program.type === draftFilters.programType)
        .map((program) => program.courseId),
    );

    return filterOptions.courses.filter((course) => visibleCourseIds.has(course.id));
  }, [draftFilters.programType, filterOptions.courses, filterOptions.programs]);

  const visiblePrograms = useMemo(
    () => filterOptions.programs.filter(
      (program) =>
        (!draftFilters.programType || program.type === draftFilters.programType) &&
        (!draftFilters.courseId || program.courseId === draftFilters.courseId),
    ),
    [draftFilters.courseId, draftFilters.programType, filterOptions.programs],
  );

  const visibleBatches = useMemo(
    () => filterOptions.batches.filter(
      (batch) =>
        (!draftFilters.programType || batch.programType === draftFilters.programType) &&
        (!draftFilters.courseId || batch.courseId === draftFilters.courseId) &&
        (!draftFilters.programId || batch.programId === draftFilters.programId),
    ),
    [draftFilters.courseId, draftFilters.programId, draftFilters.programType, filterOptions.batches],
  );

  function syncDashboardUrl(nextStats: DashboardStats) {
    const queryString = createSearchParams({
      query: searchQuery || null,
      programType: nextStats.filters.programType,
      courseId: nextStats.filters.courseId,
      programId: nextStats.filters.programId,
      batchId: nextStats.filters.batchId,
    });

    window.history.replaceState(window.history.state, "", queryString ? `${pathname}?${queryString}` : pathname);
  }

  async function applyFilters(nextFilters: DashboardFilterDraft) {
    const sanitizedFilters = sanitizeDraftFilters(nextFilters, filterOptions);
    setIsRefreshing(true);

    try {
      const nextStats = await fetchDashboardStats(sanitizedFilters);

      startTransition(() => {
        setStatsState(nextStats);
        setDraftFilters(toDraftFilters(nextStats.filters));
      });

      syncDashboardUrl(nextStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh dashboard metrics.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function updateDraftFilters(nextFilters: DashboardFilterDraft) {
    setDraftFilters(sanitizeDraftFilters(nextFilters, filterOptions));
  }

  function handleCourseChange(value: string) {
    updateDraftFilters({
      programType: draftFilters.programType,
      courseId: value,
      programId: "",
      batchId: "",
    });
  }

  function handleCategoryChange(value: string) {
    updateDraftFilters({
      programType: value,
      courseId: draftFilters.courseId,
      programId: "",
      batchId: "",
    });
  }

  function handleProgramChange(value: string) {
    const selectedProgram = filterOptions.programs.find((program) => program.id === value) ?? null;

    updateDraftFilters({
      programType: selectedProgram?.type ?? draftFilters.programType,
      courseId: selectedProgram?.courseId ?? draftFilters.courseId,
      programId: value,
      batchId: "",
    });
  }

  function handleBatchChange(value: string) {
    const selectedBatch = filterOptions.batches.find((batch) => batch.id === value) ?? null;

    updateDraftFilters({
      programType: selectedBatch?.programType ?? draftFilters.programType,
      courseId: selectedBatch?.courseId ?? draftFilters.courseId,
      programId: selectedBatch?.programId ?? draftFilters.programId,
      batchId: value,
    });
  }

  function handleResetFilters() {
    void applyFilters({ programType: "", courseId: "", programId: "", batchId: "" });
  }

  const peakStarted = Math.max(1, ...statsState.trends.map((point) => point.startedLearners));
  const peakCompleted = Math.max(1, ...statsState.trends.map((point) => point.completedLearners));
  const learnerProgressPeak = Math.max(1, statsState.activeLearners, statsState.totalEnrolled, ...statsState.learnerProgress.map((point) => point.value));
  const insightSearchResults = buildInsightSearchResult(statsState, searchQuery);
  const mergedSearchResults = searchQuery.trim().length
    ? {
        query: searchQuery,
        total: (searchResults?.total ?? 0) + (insightSearchResults?.total ?? 0),
        groups: [...(insightSearchResults?.groups ?? []), ...(searchResults?.groups ?? [])],
      }
    : null;
  const readinessFunnelStages = useMemo(
    () => statsState.readinessFunnel.map((stage) => ({
      ...stage,
      helper: READINESS_FUNNEL_STAGE_HELPERS[stage.label],
    })),
    [statsState.readinessFunnel],
  );
  const learnerProgressFunnelStages = useMemo(
    () => statsState.learnerProgress.map((stage) => ({
      label: stage.label,
      value: stage.value,
      accent: stage.accent,
      helper: stage.helper,
    })),
    [statsState.learnerProgress],
  );
  const quickActions = useMemo(
    () => [
      {
        href: "/courses",
        title: "Manage Courses",
        description: "Review lifecycle status, publish courses, and resolve approval blockers.",
        icon: BookOpenText,
      },
      {
        href: "/curriculum-builder",
        title: "Update Curriculum",
        description: "Fill published-course gaps and keep required learning paths current.",
        icon: GraduationCap,
      },
      {
        href: "/assessments",
        title: "Review Quiz Pools",
        description: "Maintain reusable assessments and resolve scheduling gaps.",
        icon: ClipboardList,
      },
      {
        href: "/schedule",
        title: "Adjust Schedule",
        description: "Investigate overdue assessment schedules and rebalance delivery activity.",
        icon: CalendarCheck2,
      },
    ],
    [],
  );
  const hiddenWidgetIds = new Set(resolvedWidgetPreferences.hidden);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  function handleWidgetDragEnd(event: DragEndEvent) {
    const activeId = event.active.id;
    const overId = event.over?.id;

    if (!isDashboardWidgetId(activeId) || !isDashboardWidgetId(overId) || activeId === overId) {
      return;
    }

    setWidgetPreferences((previous) => ({
      ...previous,
      order: reorderVisibleWidgetIds(previous.order, previous.hidden, activeId, overId),
    }));
  }

  function handleWidgetVisibilityChange(widgetId: DashboardWidgetId, shouldBeVisible: boolean) {
    setWidgetPreferences((previous) => {
      const hidden = new Set(previous.hidden);

      if (shouldBeVisible) {
        hidden.delete(widgetId);
      } else {
        hidden.add(widgetId);
      }

      return {
        ...previous,
        hidden: Array.from(hidden),
      };
    });
  }

  function handleShowAllWidgets() {
    setWidgetPreferences((previous) => ({
      ...previous,
      hidden: [],
    }));
  }

  function handleResetWidgetPreferences() {
    setWidgetPreferences(DEFAULT_DASHBOARD_WIDGET_PREFERENCES);
    toast.success("Dashboard layout reset to the default arrangement.");
  }

  function handleWidgetResize(widgetId: DashboardWidgetId, size: DashboardWidgetSize) {
    setWidgetPreferences((previous) => ({
      ...previous,
      sizes: { ...previous.sizes, [widgetId]: size },
    }));
  }

  const widgetDefinitions = useMemo<DashboardWidgetDefinition[]>(() => [
    {
      id: "operations-snapshot",
      title: "Operations Snapshot",
      description: "High-priority delivery checks and approval health in one glance.",
      defaultSize: "full",
      allowedSizes: [...DASHBOARD_WIDGET_SIZES],
      content: statsState.operationsSnapshot.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statsState.operationsSnapshot.map((snapshot) => (
            <div key={snapshot.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{snapshot.title}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{snapshot.message}</p>
              <p className={cn("mt-3 text-xs font-black uppercase tracking-[0.18em]", snapshot.tone === "danger" ? "text-rose-600" : "text-primary")}>
                {snapshot.tone === "danger" ? "Needs Attention" : "Healthy"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <WidgetEmptyState message="No operational alerts are available for the current scope." />
      ),
    },
    {
      id: "course-status-overview",
      title: "Course Status Overview",
      description: "View course distribution across draft, published, archived, and pending approval states.",
      defaultSize: "lg",
      allowedSizes: ["md", "lg", "full"],
      content: <CourseStatusDonut points={statsState.courseStatusBreakdown} totalCourses={statsState.totalCourses} />,
    },
    {
      id: "readiness-funnel",
      title: "Learner Readiness Funnel",
      description: "Track how the current learner population moves from enrollment to placement readiness.",
      defaultSize: "md",
      allowedSizes: [...DASHBOARD_WIDGET_SIZES],
      content: <DashboardStageFunnel stages={readinessFunnelStages} />,
    },
    {
      id: "learner-progress",
      title: "Learner Progress Overview",
      description: "Compare not-started, in-progress, and completed learners against the active LMS footprint.",
      defaultSize: "lg",
      allowedSizes: ["md", "lg", "full"],
      content: (
        <>
          {statsState.learnerProgress.map((item) => (
            <div key={item.key} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.helper}</p>
                </div>
                <p className="text-lg font-black tracking-tight text-primary">{item.value.toLocaleString("en-IN")}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div className={cn("h-2 rounded-full", item.accent)} style={{ width: `${(item.value / learnerProgressPeak) * 100}%` }} />
              </div>
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Attendance</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.averageAttendance.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Assessment Score</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.averageAssessmentScore.toFixed(1)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 xl:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Placement Ready</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.placementReady.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </>
      ),
    },
    {
      id: "learner-progress-funnel",
      title: "Learner Progress Funnel",
      description: "See how learners are distributed across not-started, in-progress, and completed curriculum stages.",
      defaultSize: "md",
      allowedSizes: [...DASHBOARD_WIDGET_SIZES],
      content: <DashboardStageFunnel stages={learnerProgressFunnelStages} />,
    },
    {
      id: "pending-actions",
      title: "Pending Actions",
      description: "Focus the team on approval bottlenecks, overdue assessment schedules, and curriculum gaps.",
      defaultSize: "md",
      allowedSizes: [...DASHBOARD_WIDGET_SIZES],
      content: statsState.pendingActions.length > 0 ? (
        <div className="space-y-3">
          {statsState.pendingActions.map((item) => (
            <div key={item.id} className={cn("rounded-2xl border p-4", getToneClasses(item.tone))}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-2 text-sm leading-6">{item.detail}</p>
                </div>
                <Badge variant={item.tone === "danger" ? "danger" : item.tone === "warning" ? "warning" : item.tone === "info" ? "info" : "default"}>
                  {item.count}
                </Badge>
              </div>
              {item.href ? (
                <div className="mt-3">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={item.href}>
                      Open Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <WidgetEmptyState message="No pending actions are open for the current scope." />
      ),
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      description: "Jump directly into the workspaces that move LMS operations forward.",
      defaultSize: "full",
      allowedSizes: ["md", "lg", "full"],
      content: (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link key={action.href} href={action.href} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white p-2 text-primary ring-1 ring-slate-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{action.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{action.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                </div>
              </Link>
            );
          })}
        </div>
      ),
    },
    {
      id: "learning-trendline",
      title: "Learning Progress Trendline",
      description: "Started versus completed learners across the last six months.",
      defaultSize: "lg",
      allowedSizes: ["md", "lg", "full"],
      content: (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statsState.trends.map((point) => (
            <div key={point.label} className="space-y-3 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{point.label}</p>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>Started</span>
                    <span>{formatCompactNumber(point.startedLearners)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(point.startedLearners / peakStarted) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>Completed</span>
                    <span>{point.completedLearners}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-orange-100">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${(point.completedLearners / peakCompleted) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "recent-activity",
      title: "Recent Activity",
      description: "Latest audit and platform events relevant to the current dashboard scope.",
      defaultSize: "md",
      allowedSizes: [...DASHBOARD_WIDGET_SIZES],
      content: statsState.recentActivity.length > 0 ? (
        <div className="space-y-3">
          {statsState.recentActivity.map((item) => (
            <div key={item.id} className={cn("rounded-2xl border p-4", getToneClasses(item.tone))}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6">{item.detail}</p>
                </div>
                <Badge variant={item.tone === "danger" ? "danger" : item.tone === "warning" ? "warning" : "info"}>
                  {formatOccurredAt(item.occurredAt)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <WidgetEmptyState message="No recent dashboard activity is available for the current scope." />
      ),
    },
    {
      id: "trainer-workload",
      title: "Trainer Workload",
      description: "Current trainer allocation across active batches, learners, and near-term sessions.",
      defaultSize: "lg",
      allowedSizes: ["md", "lg", "full"],
      content: statsState.trainerWorkload.length > 0 ? (
        <div className="space-y-3">
          {statsState.trainerWorkload.map((trainer) => (
            <div key={trainer.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{trainer.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{trainer.specialization}</p>
                </div>
                <Badge variant="info">Capacity {trainer.capacity}</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Active Batches</p>
                  <p className="mt-2 text-xl font-black tracking-tight text-primary">{trainer.activeBatches}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Learners</p>
                  <p className="mt-2 text-xl font-black tracking-tight text-primary">{trainer.activeLearners}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Next 14 Days</p>
                  <p className="mt-2 text-xl font-black tracking-tight text-primary">{trainer.upcomingSessions}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <WidgetEmptyState message="No active trainer workload is available for the current scope." />
      ),
    },
    {
      id: "delivery-coverage",
      title: "Delivery Coverage",
      description: "Operational readiness across curriculum, resources, assessment pools, and learner movement.",
      defaultSize: "full",
      allowedSizes: ["md", "lg", "full"],
      content: (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Published Curricula</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.publishedCurricula.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Published Resources</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.publishedResources.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Assessment Cleared</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.assessmentCleared.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Placement Ready</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-primary">{statsState.placementReady.toLocaleString("en-IN")}</p>
            </div>
        </div>
      ),
    },
  ], [
    learnerProgressPeak,
    learnerProgressFunnelStages,
    peakCompleted,
    peakStarted,
    quickActions,
    readinessFunnelStages,
    statsState,
  ]);
  const widgetById = useMemo(
    () => new Map(widgetDefinitions.map((widget) => [widget.id, widget])),
    [widgetDefinitions],
  );
  const orderedWidgetDefinitions = resolvedWidgetPreferences.order
    .map((widgetId) => widgetById.get(widgetId) ?? null)
    .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));
  const visibleWidgetDefinitions = orderedWidgetDefinitions.filter((widget) => !hiddenWidgetIds.has(widget.id));
  const visibleWidgetCount = visibleWidgetDefinitions.length;
  const hiddenWidgetCount = resolvedWidgetPreferences.hidden.length;

  return (
    <div className="space-y-6">
      <StatsGrid
        stats={statsState}
        searchQuery={searchQuery}
        filterOptions={{
          categories: filterOptions.categories,
          courses: visibleCourses,
          programs: visiblePrograms,
          batches: visibleBatches,
        }}
        draftFilters={draftFilters}
        isRefreshing={isRefreshing}
        onCategoryChange={handleCategoryChange}
        onCourseChange={handleCourseChange}
        onProgramChange={handleProgramChange}
        onBatchChange={handleBatchChange}
        onApplyFilters={() => {
          void applyFilters(draftFilters);
        }}
        onResetFilters={handleResetFilters}
        onApplyGlobalView={handleResetFilters}
      />

      {mergedSearchResults ? <DashboardSearchResults search={mergedSearchResults} /> : null}

      <div className={`space-y-6 transition-opacity ${isRefreshing ? "opacity-70" : "opacity-100"}`}>
        <Sheet open={isPersonalizationOpen} onOpenChange={setIsPersonalizationOpen}>
          <SheetContent className="flex w-full max-w-[420px] flex-col gap-0 p-0 sm:max-w-[460px]">
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>Widget Library</SheetTitle>
              <SheetDescription className="mt-2 leading-6">
                Show or hide widgets here. Drag the visible cards on the dashboard itself to change their saved order.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Visible Widgets</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{visibleWidgetCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Hidden Widgets</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{hiddenWidgetCount}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Hidden widgets stay in the saved layout and return to the same position when you enable them again.
              </div>

              <div className="space-y-3">
                {orderedWidgetDefinitions.map((widget, index) => {
                  const isVisible = !hiddenWidgetIds.has(widget.id);

                  return (
                    <label key={widget.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/50">
                      <Checkbox checked={isVisible} onCheckedChange={(checked) => handleWidgetVisibilityChange(widget.id, checked === true)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{widget.title}</p>
                          <Badge variant={isVisible ? "info" : "warning"}>{isVisible ? `Visible · ${index + 1}` : "Hidden"}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{widget.description}</p>
                        {isVisible ? (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="mr-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Size</span>
                            {widget.allowedSizes.map((size) => {
                              const widgetCurrentSize = resolvedWidgetPreferences.sizes[widget.id] ?? widget.defaultSize;
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); handleWidgetResize(widget.id, size); }}
                                  title={WIDGET_SIZE_LABELS[size]}
                                  className={cn(
                                    "inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-black transition-all",
                                    widgetCurrentSize === size
                                      ? "bg-primary text-white shadow-sm"
                                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600",
                                  )}
                                >
                                  {WIDGET_SIZE_SHORT_LABELS[size]}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                    </label>
                  );
                })}
              </div>
            </div>

            <SheetFooter className="border-t bg-white px-6 py-4">
              <Button type="button" variant="ghost" onClick={handleResetWidgetPreferences}>
                <RotateCcw className="h-4 w-4" />
                Reset Layout
              </Button>
              <Button type="button" variant="secondary" onClick={handleShowAllWidgets}>Show All Widgets</Button>
              <Button type="button" onClick={() => setIsPersonalizationOpen(false)}>Done</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-slate-500">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Dashboard Personalization
              </CardTitle>
              <CardDescription className="mt-2 text-sm leading-6">
                Open the widget library to control visibility, then drag the visible cards directly on the dashboard to save their order automatically in this browser{user?.email ? ` for ${user.email}` : ""}.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{visibleWidgetCount} visible</Badge>
              {hiddenWidgetCount > 0 ? <Badge variant="warning">{hiddenWidgetCount} hidden</Badge> : null}
              <Button type="button" variant="secondary" onClick={() => setIsPersonalizationOpen(true)}>
                Open Widget Library
              </Button>
              <Button type="button" variant="ghost" onClick={handleResetWidgetPreferences}>
                <RotateCcw className="h-4 w-4" />
                Reset Layout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Tip: use each card’s drag handle to reorder the visible widgets. The widget library is optimized for visibility changes, especially on smaller screens.
            </div>
          </CardContent>
        </Card>

        {visibleWidgetDefinitions.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}>
            <SortableContext items={visibleWidgetDefinitions.map((widget) => widget.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6 xl:grid-cols-12">
                {visibleWidgetDefinitions.map((widget) => (
                  <DashboardSortableWidget
                    key={widget.id}
                    widget={widget}
                    currentSize={resolvedWidgetPreferences.sizes[widget.id] ?? widget.defaultSize}
                    onResize={(size) => handleWidgetResize(widget.id, size)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <Card>
            <CardContent className="p-6">
              <WidgetEmptyState message="All widgets are hidden. Turn at least one widget back on to rebuild your dashboard surface." />
              <div className="mt-4">
                <Button type="button" variant="secondary" onClick={handleShowAllWidgets}>Show All Widgets</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}