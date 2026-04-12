"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  ClipboardList,
  FileText,
  FolderOpen,
  Layers,
  Mail,
  MapPin,
  UserPlus,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { CreateBatchSheet } from "@/components/modules/batches/create-batch-sheet";
import { AddTrainerSheet } from "@/components/modules/trainers/add-trainer-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import { getCourseStatusBadgeVariant, getCourseStatusDescription, getCourseStatusLabel } from "@/lib/course-status";
import { useRbac } from "@/lib/rbac-context";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { cn } from "@/lib/utils";
import type { CourseBatchSummary, CourseDetail, CourseProgramSummary } from "@/services/courses/types";
import type { TrainerOption, TrainerRegistryResponse } from "@/services/trainers/types";
import type { CandidateUserListItem, CandidateUsersResponse } from "@/types";

type CourseContentSummary = {
  id: string;
  title: string;
  contentType: string;
  folderId: string | null;
  folderName: string | null;
  sourceCourseName?: string;
  sourceFolderName?: string | null;
  resourceVisibility?: string;
  assignedAt?: string;
  isSharedAssignment?: boolean;
  shareKind?: "COURSE_ASSIGNMENT";
};

type CourseFolderSummary = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  contentCount: number;
};

type CurriculumSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  updatedAt: string;
};

type AssessmentSummary = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  timeLimitMinutes: number | null;
  status: string;
  questionCount: number;
};

type CourseDetailSheetProps = {
  courseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (courseId: string) => void;
};

type ProgramBatchMatrixProps = {
  programs: CourseProgramSummary[];
  emptyMessage: string;
  renderBatchAction?: (program: CourseProgramSummary, batch: CourseBatchSummary, actionDisabled: boolean) => ReactNode;
};

const EMPTY_TRAINER_RESPONSE: TrainerRegistryResponse = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 8,
  pageCount: 1,
  filterOptions: {
    specializations: [],
  },
};

const EMPTY_CANDIDATE_RESPONSE: CandidateUsersResponse = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 8,
  pageCount: 1,
};

const PICKER_PAGE_SIZES = [8, 16, 25, 50];

const contentTypeLabels: Record<string, string> = {
  ARTICLE: "Authored Lesson",
  PDF: "PDF",
  DOCUMENT: "Document",
  VIDEO: "Video",
  SCORM: "SCORM",
  LINK: "Link",
  OTHER: "Other",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getWorkflowBadgeVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "PUBLISHED":
    case "PLANNED":
    case "IN_SESSION":
      return "success";
    case "DRAFT":
    case "IN_REVIEW":
      return "warning";
    case "ARCHIVED":
      return "default";
    case "INACTIVE":
    case "CANCELLED":
      return "danger";
    default:
      return "info";
  }
}

function isInteractiveBatch(status: string) {
  return status === "DRAFT" || status === "PLANNED" || status === "IN_SESSION";
}

async function readApiData<T>(response: Response, errorMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || errorMessage);
  }

  return payload?.data as T;
}

function sortFolderSummaries(left: CourseFolderSummary, right: CourseFolderSummary) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name);
}

function buildContentMeta(content: CourseContentSummary) {
  if (content.shareKind === "COURSE_ASSIGNMENT") {
    return `Assigned from ${content.sourceCourseName ?? "another course"}${content.sourceFolderName ? ` / ${content.sourceFolderName}` : ""}`;
  }

  return content.folderName ? `Folder: ${content.folderName}` : "Course root content";
}

function MetricTile({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "amber" | "sky" | "emerald" }) {
  const toneClasses = {
    slate: "bg-white text-slate-900",
    amber: "bg-amber-50 text-amber-900",
    sky: "bg-sky-50 text-sky-900",
    emerald: "bg-emerald-50 text-emerald-900",
  } as const;

  return (
    <div className={cn("rounded-2xl border border-white/80 px-4 py-4 shadow-sm", toneClasses[tone])}>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function ProgramBatchMatrix({ programs, emptyMessage, renderBatchAction }: ProgramBatchMatrixProps) {
  if (programs.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {programs.map((program) => (
        <div key={program.id} className="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{program.name}</p>
                <Badge variant={program.isActive ? "success" : "danger"}>{program.isActive ? "Active" : "Inactive"}</Badge>
                <Badge variant="info">{formatEnumLabel(program.type)}</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {program.batchCount} batches • {program.candidateCount} candidates • {program.trainerCount} trainers
              </p>
            </div>
          </div>

          {program.batches.length > 0 ? (
            <div className="mt-4 space-y-3">
              {program.batches.map((batch) => {
                const actionDisabled = !isInteractiveBatch(batch.status);

                return (
                  <div key={batch.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{batch.name}</p>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{batch.code}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {batch.campus ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {batch.campus}
                            </span>
                          ) : null}
                          <span>{batch.candidateCount} candidates</span>
                          <span>{batch.trainerNames.length} trainers</span>
                          <span>Capacity {batch.capacity}</span>
                          {batch.startDate ? <span>Starts {formatShortDate(batch.startDate)}</span> : null}
                        </div>
                        {batch.trainerNames.length > 0 ? (
                          <p className="mt-2 text-xs text-slate-500">Trainers: {batch.trainerNames.join(", ")}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-2 xl:items-end">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getWorkflowBadgeVariant(batch.status)}>{formatEnumLabel(batch.status)}</Badge>
                          <Badge variant="info">{formatEnumLabel(batch.mode)}</Badge>
                        </div>
                        {renderBatchAction ? renderBatchAction(program, batch, actionDisabled) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No batches are configured under this program yet.</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function CourseDetailSheet({ courseId, open, onOpenChange, onEdit }: CourseDetailSheetProps) {
  const router = useRouter();
  const { can } = useRbac();
  const canViewCurriculum = can("curriculum.view");
  const canViewAssessments = can("assessment_pool.view");
  const canCreateBatch = can("batches.create");
  const canEditBatches = can("batches.edit");
  const canViewTrainers = can("trainers.view");
  const canCreateTrainer = can("trainers.create");
  const canViewCandidates = can(CANDIDATE_USERS_PERMISSIONS.view);
  const canEditCourse = can("courses.edit");
  const canOpenTrainerEnrollment = canViewTrainers && canEditBatches;
  const canOpenCandidateEnrollment = canViewCandidates && canEditBatches;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [courseContents, setCourseContents] = useState<CourseContentSummary[]>([]);
  const [courseFolders, setCourseFolders] = useState<CourseFolderSummary[]>([]);
  const [assignedCourseContents, setAssignedCourseContents] = useState<CourseContentSummary[]>([]);
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [trainerPickerOpen, setTrainerPickerOpen] = useState(false);
  const [trainerSearchTerm, setTrainerSearchTerm] = useState("");
  const deferredTrainerSearchTerm = useDeferredValue(trainerSearchTerm);
  const [trainerSearchPage, setTrainerSearchPage] = useState(1);
  const [trainerSearchPageSize, setTrainerSearchPageSize] = useState(8);
  const [trainerSearchResponse, setTrainerSearchResponse] = useState<TrainerRegistryResponse>(EMPTY_TRAINER_RESPONSE);
  const [isLoadingTrainerSearch, setIsLoadingTrainerSearch] = useState(false);
  const [trainerSearchError, setTrainerSearchError] = useState<string | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerOption | null>(null);
  const [assigningTrainerBatchId, setAssigningTrainerBatchId] = useState<string | null>(null);
  const [candidatePickerOpen, setCandidatePickerOpen] = useState(false);
  const [candidateSearchTerm, setCandidateSearchTerm] = useState("");
  const deferredCandidateSearchTerm = useDeferredValue(candidateSearchTerm);
  const [candidateSearchPage, setCandidateSearchPage] = useState(1);
  const [candidateSearchPageSize, setCandidateSearchPageSize] = useState(8);
  const [candidateSearchResponse, setCandidateSearchResponse] = useState<CandidateUsersResponse>(EMPTY_CANDIDATE_RESPONSE);
  const [isLoadingCandidateSearch, setIsLoadingCandidateSearch] = useState(false);
  const [candidateSearchError, setCandidateSearchError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateUserListItem | null>(null);
  const [enrollingCandidateBatchId, setEnrollingCandidateBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !courseId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/courses/${courseId}`, { cache: "no-store" }),
      fetch(`/api/course-content?courseId=${courseId}`, { cache: "no-store" }),
      fetch(`/api/course-content-folders?courseId=${courseId}`, { cache: "no-store" }),
      fetch(`/api/course-content/shared?courseId=${courseId}`, { cache: "no-store" }),
      canViewCurriculum ? fetch(`/api/curriculum?courseId=${courseId}`, { cache: "no-store" }) : Promise.resolve(null),
      canViewAssessments ? fetch(`/api/assessment-pool?courseId=${courseId}`, { cache: "no-store" }) : Promise.resolve(null),
    ])
      .then(async ([courseResponse, contentResponse, folderResponse, assignedResponse, curriculumResponse, assessmentResponse]) => {
        const [nextCourse, nextContents, nextFolders, nextAssignedContents] = await Promise.all([
          readApiData<CourseDetail>(courseResponse, "Failed to load course details."),
          readApiData<CourseContentSummary[]>(contentResponse, "Failed to load course content."),
          readApiData<CourseFolderSummary[]>(folderResponse, "Failed to load course folders."),
          readApiData<CourseContentSummary[]>(assignedResponse, "Failed to load assigned course content."),
        ]);

        const [curriculaResult, assessmentsResult] = await Promise.allSettled([
          canViewCurriculum && curriculumResponse
            ? readApiData<CurriculumSummary[]>(curriculumResponse, "Failed to load curriculum.")
            : Promise.resolve([]),
          canViewAssessments && assessmentResponse
            ? readApiData<AssessmentSummary[]>(assessmentResponse, "Failed to load assessments.")
            : Promise.resolve([]),
        ]);

        if (!active) {
          return;
        }

        setCourse(nextCourse ? {
          ...nextCourse,
          assignedSharedContents: nextCourse.assignedSharedContents ?? [],
        } : null);
        setCourseContents(nextContents);
        setCourseFolders(nextFolders);
        setAssignedCourseContents(nextAssignedContents);
        setCurricula(curriculaResult.status === "fulfilled" ? curriculaResult.value : []);
        setAssessments(assessmentsResult.status === "fulfilled" ? assessmentsResult.value : []);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load course details.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewAssessments, canViewCurriculum, courseId, open, reloadKey]);

  const rootContents = useMemo(
    () => [...courseContents.filter((content) => !content.folderId), ...assignedCourseContents],
    [assignedCourseContents, courseContents],
  );

  const folderSections = useMemo(() => {
    return [...courseFolders].sort(sortFolderSummaries).map((folder) => ({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      contents: courseContents.filter((content) => content.folderId === folder.id),
    }));
  }, [courseContents, courseFolders]);

  const trainerAssignments = useMemo(
    () => (selectedTrainer ? course?.trainers.find((trainer) => trainer.id === selectedTrainer.id) ?? null : null),
    [course?.trainers, selectedTrainer],
  );

  const candidateEnrollmentRecord = useMemo(
    () => (selectedCandidate?.learnerCode ? course?.candidates.find((candidate) => candidate.learnerCode === selectedCandidate.learnerCode) ?? null : null),
    [course?.candidates, selectedCandidate],
  );

  const totalContentCount = rootContents.length + folderSections.reduce((sum, section) => sum + section.contents.length, 0);
  const curriculumCount = curricula.length;
  const assessmentCount = assessments.length;
  const totalBatchCount = course?.batches.length ?? 0;
  const totalCandidateCount = course?.candidates.length ?? 0;

  const refreshWorkspace = () => {
    setReloadKey((current) => current + 1);
  };

  useEffect(() => {
    setTrainerSearchPage(1);
  }, [deferredTrainerSearchTerm]);

  useEffect(() => {
    if (!trainerPickerOpen) {
      setTrainerSearchPage(1);
    }
  }, [trainerPickerOpen]);

  useEffect(() => {
    setCandidateSearchPage(1);
  }, [deferredCandidateSearchTerm]);

  useEffect(() => {
    if (!candidatePickerOpen) {
      setCandidateSearchPage(1);
    }
  }, [candidatePickerOpen]);

  useEffect(() => {
    if (!trainerPickerOpen || !courseId || !canViewTrainers) {
      return;
    }

    let active = true;
    setIsLoadingTrainerSearch(true);
    setTrainerSearchError(null);

    const params = new URLSearchParams({
      page: String(trainerSearchPage),
      pageSize: String(trainerSearchPageSize),
      search: deferredTrainerSearchTerm.trim(),
      status: "ACTIVE",
      availability: "ALL",
      specialization: "",
      sortBy: "fullName",
      sortDirection: "asc",
    });

    fetch(`/api/trainers/registry?${params.toString()}`, { cache: "no-store" })
      .then((response) => readApiData<TrainerRegistryResponse>(response, "Failed to search trainers."))
      .then((result) => {
        if (!active) {
          return;
        }

        setTrainerSearchResponse(result);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setTrainerSearchError(loadError instanceof Error ? loadError.message : "Failed to search trainers.");
        setTrainerSearchResponse(EMPTY_TRAINER_RESPONSE);
      })
      .finally(() => {
        if (active) {
          setIsLoadingTrainerSearch(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewTrainers, courseId, deferredTrainerSearchTerm, trainerPickerOpen, trainerSearchPage, trainerSearchPageSize]);

  useEffect(() => {
    if (!candidatePickerOpen || !canViewCandidates) {
      return;
    }

    let active = true;
    setIsLoadingCandidateSearch(true);
    setCandidateSearchError(null);

    const params = new URLSearchParams({
      page: String(candidateSearchPage),
      pageSize: String(candidateSearchPageSize),
      search: deferredCandidateSearchTerm.trim(),
      status: "ACTIVE",
      sortBy: "name",
      sortDirection: "asc",
    });

    fetch(`/api/users/candidates?${params.toString()}`, { cache: "no-store" })
      .then((response) => readApiData<CandidateUsersResponse>(response, "Failed to search candidates."))
      .then((result) => {
        if (!active) {
          return;
        }

        setCandidateSearchResponse({
          ...result,
          items: result.items.filter((candidate) => Boolean(candidate.learnerCode)),
        });
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setCandidateSearchError(loadError instanceof Error ? loadError.message : "Failed to search candidates.");
        setCandidateSearchResponse(EMPTY_CANDIDATE_RESPONSE);
      })
      .finally(() => {
        if (active) {
          setIsLoadingCandidateSearch(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewCandidates, candidatePickerOpen, candidateSearchPage, candidateSearchPageSize, deferredCandidateSearchTerm]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCourse(null);
      setCourseContents([]);
      setCourseFolders([]);
      setAssignedCourseContents([]);
      setCurricula([]);
      setAssessments([]);
      setError(null);
      setTrainerPickerOpen(false);
      setTrainerSearchTerm("");
      setTrainerSearchPage(1);
      setTrainerSearchPageSize(8);
      setTrainerSearchResponse(EMPTY_TRAINER_RESPONSE);
      setTrainerSearchError(null);
      setSelectedTrainer(null);
      setAssigningTrainerBatchId(null);
      setCandidatePickerOpen(false);
      setCandidateSearchTerm("");
      setCandidateSearchPage(1);
      setCandidateSearchPageSize(8);
      setCandidateSearchResponse(EMPTY_CANDIDATE_RESPONSE);
      setCandidateSearchError(null);
      setSelectedCandidate(null);
      setEnrollingCandidateBatchId(null);
    }
  };

  const openWorkspace = (pathname: string) => {
    handleOpenChange(false);
    router.push(pathname);
  };

  const handleAssignTrainer = async (batchId: string) => {
    if (!selectedTrainer) {
      toast.error("Select a trainer before assigning a batch.");
      return;
    }

    setAssigningTrainerBatchId(batchId);

    try {
      const response = await fetch(`/api/batches/${batchId}/trainers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trainerId: selectedTrainer.id }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to assign trainer to batch.");
      }

      toast.success("Trainer assigned to batch.");
      refreshWorkspace();
    } catch (assignError) {
      toast.error(assignError instanceof Error ? assignError.message : "Failed to assign trainer to batch.");
    } finally {
      setAssigningTrainerBatchId(null);
    }
  };

  const handleEnrollCandidate = async (batch: CourseBatchSummary) => {
    if (!selectedCandidate?.learnerCode) {
      toast.error("Select a candidate before enrolling into a batch.");
      return;
    }

    setEnrollingCandidateBatchId(batch.id);

    try {
      const response = await fetch(`/api/batches/${batch.id}/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          learnerCode: selectedCandidate.learnerCode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to enroll candidate.");
      }

      toast.success(`${selectedCandidate.name} enrolled into ${batch.name}.`);
      setSelectedCandidate(null);
      refreshWorkspace();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : "Unable to enroll candidate.");
    } finally {
      setEnrollingCandidateBatchId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-[1180px]">
        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : course ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle>{course.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Course delivery workspace
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={getCourseStatusBadgeVariant(course.status)}>{getCourseStatusLabel(course.status)}</Badge>
                    <Badge variant={course.isActive ? "success" : "danger"}>{course.isActive ? "Active" : "Inactive"}</Badge>
                    <Badge variant="info">{course.programs.length} programs</Badge>
                    <Badge variant="info">{totalBatchCount} batches</Badge>
                    {canViewTrainers ? <Badge variant="info">{course.trainers.length} trainers</Badge> : null}
                    {canViewCandidates ? <Badge variant="info">{totalCandidateCount} candidates</Badge> : null}
                    {canViewCurriculum ? <Badge variant="info">{curriculumCount} curricula</Badge> : null}
                    {canViewAssessments ? <Badge variant="info">{assessmentCount} assessments</Badge> : null}
                    <Badge variant="info">{totalContentCount} content items</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="space-y-6">
                <div className="rounded-[32px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Lifecycle</p>
                      <p className="mt-3 text-lg font-semibold text-slate-900">{getCourseStatusLabel(course.status)}</p>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{getCourseStatusDescription(course.status)}</p>
                      <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Description</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{course.description ?? "No description provided."}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricTile label="Programs" value={String(course.programs.length)} tone="amber" />
                      <MetricTile label="Batches" value={String(totalBatchCount)} tone="sky" />
                      <MetricTile label="Trainers" value={String(course.trainers.length)} tone="emerald" />
                      <MetricTile label="Candidates" value={String(totalCandidateCount)} />
                      <MetricTile label="Content" value={String(totalContentCount)} tone="sky" />
                      <MetricTile label="Assessments" value={String(assessmentCount)} tone="amber" />
                    </div>
                  </div>
                </div>

                {canViewCurriculum ? (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Curriculum ({curriculumCount})</p>
                          <p className="mt-1 text-sm text-slate-500">Modules, stages, and learning flow attached to this course.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openWorkspace(`/curriculum-builder?courseId=${encodeURIComponent(course.id)}`)}
                      >
                        Add Curriculum
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {curricula.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {curricula.map((curriculumItem) => (
                          <div key={curriculumItem.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">{curriculumItem.title}</p>
                                {curriculumItem.description ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{curriculumItem.description}</p> : null}
                                <p className="mt-2 text-xs text-slate-500">Updated {formatDate(curriculumItem.updatedAt)}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={getWorkflowBadgeVariant(curriculumItem.status)}>{formatEnumLabel(curriculumItem.status)}</Badge>
                                <Badge variant="info">{curriculumItem.moduleCount} modules</Badge>
                                <Badge variant="info">{curriculumItem.stageCount} stages</Badge>
                                <Badge variant="info">{curriculumItem.itemCount} items</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">No curriculum is configured for this course yet.</p>
                    )}
                  </div>
                ) : null}

                {canViewAssessments ? (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assessments ({assessmentCount})</p>
                          <p className="mt-1 text-sm text-slate-500">Reusable assessments, scoring rules, and publishing status.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openWorkspace(`/assessments?courseId=${encodeURIComponent(course.id)}`)}
                      >
                        Add Assessment
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {assessments.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {assessments.map((assessment) => (
                          <div key={assessment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{assessment.title}</p>
                                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{assessment.code}</p>
                                </div>
                                {assessment.description ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{assessment.description}</p> : null}
                                <p className="mt-2 text-xs text-slate-500">
                                  {assessment.questionCount} questions
                                  {assessment.timeLimitMinutes !== null ? ` • ${assessment.timeLimitMinutes} mins` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={getWorkflowBadgeVariant(assessment.status)}>{formatEnumLabel(assessment.status)}</Badge>
                                <Badge variant="info">{formatEnumLabel(assessment.questionType)}</Badge>
                                <Badge variant="info">{formatEnumLabel(assessment.difficultyLevel)}</Badge>
                                <Badge variant="info">{assessment.totalMarks} marks</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">No assessments are linked to this course yet.</p>
                    )}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Content Structure ({totalContentCount})</p>
                        <p className="mt-1 text-sm text-slate-500">Root content, folders, and shared assignments available to this course.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openWorkspace(`/course-builder/repository?course=${encodeURIComponent(course.id)}`)}
                    >
                      Add Content
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500" />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Course Root & Assigned Content ({rootContents.length})
                        </p>
                      </div>
                      {rootContents.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {rootContents.map((content) => (
                            <div key={`${content.id}-${content.assignedAt}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-500" />
                                    <p className="truncate text-sm font-semibold text-slate-900">{content.title}</p>
                                  </div>
                                  <p className="mt-2 text-xs text-slate-500">{buildContentMeta(content)}</p>
                                  {content.isSharedAssignment && content.assignedAt ? <p className="mt-1 text-xs text-slate-500">Assigned {formatDate(content.assignedAt)}</p> : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="info">{contentTypeLabels[content.contentType] ?? content.contentType}</Badge>
                                  {content.shareKind === "COURSE_ASSIGNMENT" ? <Badge variant="default">Assigned</Badge> : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No root-level or assigned content is available in this course yet.</p>
                      )}
                    </div>

                    {folderSections.map((section) => (
                      <div key={section.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-slate-500" />
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {section.name} ({section.contents.length})
                          </p>
                        </div>
                        {section.description ? <p className="mt-2 text-xs text-slate-500">{section.description}</p> : null}
                        {section.contents.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {section.contents.map((content) => (
                              <div key={`${section.id}-${content.id}-${content.assignedAt}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-slate-500" />
                                      <p className="truncate text-sm font-semibold text-slate-900">{content.title}</p>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">{buildContentMeta(content)}</p>
                                    {content.isSharedAssignment && content.assignedAt ? <p className="mt-1 text-xs text-slate-500">Available since {formatDate(content.assignedAt)}</p> : null}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="info">{contentTypeLabels[content.contentType] ?? content.contentType}</Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">No content is stored in this folder yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Programs & Batches ({course.programs.length})</p>
                        <p className="mt-1 text-sm text-slate-500">Every program under this course, including linked batches and delivery capacity.</p>
                      </div>
                    </div>
                    {canCreateBatch ? (
                      <CreateBatchSheet courseId={course.id} triggerLabel="Add Batch" onCreated={refreshWorkspace} />
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <ProgramBatchMatrix
                      programs={course.programs}
                      emptyMessage="No programs are linked to this course yet."
                    />
                  </div>
                </div>

                {canViewTrainers ? (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Trainers ({course.trainers.length})</p>
                          <p className="mt-1 text-sm text-slate-500">Course-level trainers plus their current batch footprint inside this course.</p>
                        </div>
                      </div>
                      {canCreateTrainer ? (
                        <AddTrainerSheet
                          initialCourseId={course.id}
                          lockCourseSelection={true}
                          triggerLabel="Add Trainer"
                          onCreated={refreshWorkspace}
                        />
                      ) : null}
                    </div>

                    {course.trainers.length > 0 ? (
                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        {course.trainers.map((trainer) => (
                          <div key={trainer.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">{trainer.fullName}</p>
                                <p className="mt-1 text-xs text-slate-500">{trainer.specialization}</p>
                                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                                  <Mail className="h-3 w-3" />
                                  {trainer.email}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={trainer.isActive ? "success" : "danger"}>{trainer.isActive ? "Active" : "Inactive"}</Badge>
                                <Badge variant="info">{trainer.assignedBatchIds.length} batches</Badge>
                              </div>
                            </div>
                            {trainer.assignedBatchLabels.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {trainer.assignedBatchLabels.map((label) => (
                                  <span key={`${trainer.id}-${label}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-slate-500">No batch is assigned to this trainer inside the course yet.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">No trainers are mapped to this course yet.</p>
                    )}

                    {canOpenTrainerEnrollment ? (
                      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assign Trainer To Batch</p>
                            <p className="mt-1 text-sm text-slate-500">Open the search popup, find a trainer, then assign them directly into any draft, planned, or live batch below.</p>
                          </div>
                          <Button type="button" variant="secondary" onClick={() => setTrainerPickerOpen(true)}>
                            Search Trainers
                          </Button>
                        </div>

                        {selectedTrainer ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">{selectedTrainer.fullName}</p>
                                <p className="mt-1 text-xs text-slate-500">{selectedTrainer.specialization} • {selectedTrainer.email}</p>
                                {trainerAssignments?.assignedBatchLabels.length ? (
                                  <p className="mt-2 text-xs text-slate-500">Current course batches: {trainerAssignments.assignedBatchLabels.join(", ")}</p>
                                ) : trainerAssignments ? (
                                  <p className="mt-2 text-xs text-slate-500">Already linked to this course, but not assigned to a batch yet.</p>
                                ) : (
                                  <p className="mt-2 text-xs text-slate-500">Not linked to this course yet. Assigning to a batch will add the course mapping automatically.</p>
                                )}
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedTrainer(null)}>
                                Clear
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <ProgramBatchMatrix
                            programs={course.programs}
                            emptyMessage="Programs need to be created before trainers can be assigned to batches."
                            renderBatchAction={(_program, batch, actionDisabled) => {
                              const alreadyAssigned = selectedTrainer ? batch.trainerIds.includes(selectedTrainer.id) : false;
                              const isAssigning = assigningTrainerBatchId === batch.id;

                              return (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={alreadyAssigned ? "ghost" : "secondary"}
                                  onClick={() => void handleAssignTrainer(batch.id)}
                                  disabled={!selectedTrainer || alreadyAssigned || actionDisabled || isAssigning}
                                >
                                  {alreadyAssigned
                                    ? "Assigned"
                                    : isAssigning
                                      ? "Assigning..."
                                      : actionDisabled
                                        ? "Batch Locked"
                                        : "Assign Trainer"}
                                </Button>
                              );
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {canViewCandidates ? (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Candidates ({course.candidates.length})</p>
                        <p className="mt-1 text-sm text-slate-500">Candidates currently enrolled somewhere inside this course delivery tree.</p>
                      </div>
                    </div>

                    {course.candidates.length > 0 ? (
                      <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {course.candidates.map((candidate) => (
                          <div key={candidate.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">{candidate.fullName}</p>
                                <p className="mt-1 text-xs text-slate-500">{candidate.learnerCode} • {candidate.email}</p>
                                {candidate.phone ? <p className="mt-1 text-xs text-slate-500">{candidate.phone}</p> : null}
                              </div>
                              <Badge variant="info">{candidate.enrollmentCount} enrollments</Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {candidate.enrollments.map((enrollment) => (
                                <span key={`${candidate.id}-${enrollment.batchId}-${enrollment.joinedAt}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {enrollment.programName} • {enrollment.batchName}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">No candidates are enrolled in this course yet.</p>
                    )}

                    {canOpenCandidateEnrollment ? (
                      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Enroll Candidate To Batch</p>
                            <p className="mt-1 text-sm text-slate-500">Open the search popup, find an existing candidate, then click a batch below to enroll them.</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="min-w-0 flex-1">
                            {selectedCandidate ? (
                              <>
                                <p className="text-sm font-semibold text-slate-900">{selectedCandidate.name}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {selectedCandidate.learnerCode} • {selectedCandidate.email}
                                  {selectedCandidate.batchCode ? ` • Current batch ${selectedCandidate.batchCode}` : ""}
                                </p>
                                {candidateEnrollmentRecord?.enrollments.length ? (
                                  <p className="mt-2 text-xs text-slate-500">
                                    Existing course enrollments: {candidateEnrollmentRecord.enrollments.map((enrollment) => `${enrollment.programName} • ${enrollment.batchName}`).join(", ")}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-sm text-slate-500">No candidate selected yet.</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {selectedCandidate ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCandidate(null)}>
                                Clear
                              </Button>
                            ) : null}
                            <Button type="button" variant="secondary" onClick={() => setCandidatePickerOpen(true)}>
                              Search Candidates
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <ProgramBatchMatrix
                            programs={course.programs}
                            emptyMessage="Programs and batches need to exist before a candidate can be enrolled into this course."
                            renderBatchAction={(_program, batch, actionDisabled) => {
                              const isEnrolling = enrollingCandidateBatchId === batch.id;
                              const alreadyEnrolled = selectedCandidate?.learnerCode
                                ? Boolean(candidateEnrollmentRecord?.enrollments.some((enrollment) => enrollment.batchId === batch.id))
                                : false;

                              return (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={alreadyEnrolled ? "ghost" : "secondary"}
                                  onClick={() => void handleEnrollCandidate(batch)}
                                  disabled={!selectedCandidate?.learnerCode || alreadyEnrolled || actionDisabled || isEnrolling}
                                >
                                  {alreadyEnrolled ? "Already Enrolled" : isEnrolling ? "Enrolling..." : actionDisabled ? "Batch Locked" : "Enroll Candidate"}
                                </Button>
                              );
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              {canEditCourse ? <Button onClick={() => onEdit(course.id)}>Edit Course</Button> : null}
            </SheetFooter>

            <Dialog open={trainerPickerOpen} onOpenChange={setTrainerPickerOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Search Trainers</DialogTitle>
                  <DialogDescription>Find any active trainer, then use the selected trainer for batch assignment. Trainers not yet linked to this course will be added automatically when assigned.</DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</label>
                    <Input
                      value={trainerSearchTerm}
                      placeholder="Search by name, email, specialization, or employee code"
                      onChange={(event) => setTrainerSearchTerm(event.target.value)}
                    />
                  </div>

                  {trainerSearchError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{trainerSearchError}</p> : null}
                  {isLoadingTrainerSearch ? <p className="text-sm text-slate-500">Searching trainers...</p> : null}

                  {!isLoadingTrainerSearch && trainerSearchResponse.items.length === 0 ? (
                    <p className="text-sm text-slate-500">No trainers matched this search.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {trainerSearchResponse.items.map((trainer) => {
                          const isSelected = selectedTrainer?.id === trainer.id;
                          const isInCourse = course?.trainers.some((courseTrainer) => courseTrainer.id === trainer.id) ?? false;

                          return (
                            <button
                              key={trainer.id}
                              type="button"
                              onClick={() => setSelectedTrainer(trainer)}
                              className={cn(
                                "rounded-2xl border px-4 py-4 text-left transition-colors",
                                isSelected
                                  ? "border-[#0d3b84] bg-blue-50 text-slate-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                              )}
                              aria-pressed={isSelected}
                            >
                              <p className="text-sm font-semibold">{trainer.fullName}</p>
                              <p className="mt-1 text-xs text-slate-500">{trainer.specialization}</p>
                              <p className="mt-1 text-xs text-slate-500">{trainer.email}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant={trainer.isActive ? "success" : "danger"}>{trainer.isActive ? "Active" : "Inactive"}</Badge>
                                <Badge variant="info">{trainer.availabilityStatus}</Badge>
                                <Badge variant={isInCourse ? "success" : "warning"}>{isInCourse ? "In Course" : "Add To Course"}</Badge>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <DataTablePagination
                        currentPage={trainerSearchPage - 1}
                        pageCount={trainerSearchResponse.pageCount}
                        totalRows={trainerSearchResponse.totalCount}
                        visibleRows={trainerSearchResponse.items.length}
                        pageSize={trainerSearchPageSize}
                        pageSizes={PICKER_PAGE_SIZES}
                        onPageChange={(page) => setTrainerSearchPage(page + 1)}
                        onPageSizeChange={(size) => {
                          setTrainerSearchPageSize(size);
                          setTrainerSearchPage(1);
                        }}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="justify-between sm:justify-between">
                  <p className="text-xs text-slate-500">
                    {selectedTrainer ? `Selected trainer: ${selectedTrainer.fullName}` : "Select one trainer to continue with batch assignment."}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setTrainerPickerOpen(false)}>
                      Close
                    </Button>
                    <Button type="button" onClick={() => setTrainerPickerOpen(false)} disabled={!selectedTrainer}>
                      Use Selected Trainer
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={candidatePickerOpen} onOpenChange={setCandidatePickerOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Search Candidates</DialogTitle>
                  <DialogDescription>Find an existing candidate account, then use the selected candidate for batch enrollment.</DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search</label>
                    <Input
                      value={candidateSearchTerm}
                      placeholder="Search by name, learner code, or email"
                      onChange={(event) => setCandidateSearchTerm(event.target.value)}
                    />
                  </div>

                  {candidateSearchError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{candidateSearchError}</p> : null}
                  {isLoadingCandidateSearch ? <p className="text-sm text-slate-500">Searching candidates...</p> : null}

                  {!isLoadingCandidateSearch && candidateSearchResponse.items.length === 0 ? (
                    <p className="text-sm text-slate-500">No candidates matched this search.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {candidateSearchResponse.items.map((candidate) => {
                          const isSelected = selectedCandidate?.id === candidate.id;

                          return (
                            <button
                              key={candidate.id}
                              type="button"
                              onClick={() => setSelectedCandidate(candidate)}
                              className={cn(
                                "rounded-2xl border px-4 py-4 text-left transition-colors",
                                isSelected
                                  ? "border-[#0d3b84] bg-blue-50 text-slate-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                              )}
                              aria-pressed={isSelected}
                              disabled={!candidate.learnerCode}
                            >
                              <p className="text-sm font-semibold">{candidate.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{candidate.learnerCode ?? "No learner code"} • {candidate.email}</p>
                              {candidate.phone ? <p className="mt-1 text-xs text-slate-500">{candidate.phone}</p> : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant={candidate.isActive ? "success" : "danger"}>{candidate.isActive ? "Active" : "Inactive"}</Badge>
                                {candidate.batchCode ? <Badge variant="info">Current batch {candidate.batchCode}</Badge> : null}
                                {candidate.programName ? <Badge variant="info">{candidate.programName}</Badge> : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <DataTablePagination
                        currentPage={candidateSearchPage - 1}
                        pageCount={candidateSearchResponse.pageCount}
                        totalRows={candidateSearchResponse.totalCount}
                        visibleRows={candidateSearchResponse.items.length}
                        pageSize={candidateSearchPageSize}
                        pageSizes={PICKER_PAGE_SIZES}
                        onPageChange={(page) => setCandidateSearchPage(page + 1)}
                        onPageSizeChange={(size) => {
                          setCandidateSearchPageSize(size);
                          setCandidateSearchPage(1);
                        }}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="justify-between sm:justify-between">
                  <p className="text-xs text-slate-500">
                    {selectedCandidate ? `Selected candidate: ${selectedCandidate.name}` : "Select one candidate to continue with batch enrollment."}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setCandidatePickerOpen(false)}>
                      Close
                    </Button>
                    <Button type="button" onClick={() => setCandidatePickerOpen(false)} disabled={!selectedCandidate?.learnerCode}>
                      Use Selected Candidate
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}