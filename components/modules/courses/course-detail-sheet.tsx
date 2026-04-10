"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpenText, ClipboardList, FileText, FolderOpen, Layers, Share2, UserRound, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import { getCourseStatusBadgeVariant, getCourseStatusDescription, getCourseStatusLabel } from "@/lib/course-status";
import { useRbac } from "@/lib/rbac-context";
import { CourseStatus } from "@/types";

type CourseProgramSummary = {
  id: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
  isActive: boolean;
};

type CourseTrainerSummary = {
  id: string;
  fullName: string;
  specialization: string;
};

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

type CourseDetail = {
  id: string;
  name: string;
  description: string | null;
  status: CourseStatus;
  isActive: boolean;
  programs: CourseProgramSummary[];
  trainers: CourseTrainerSummary[];
  assignedSharedContents?: CourseContentSummary[];
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
      return "success";
    case "DRAFT":
    case "IN_REVIEW":
      return "warning";
    case "ARCHIVED":
      return "default";
    case "INACTIVE":
      return "danger";
    default:
      return "info";
  }
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

export function CourseDetailSheet({ courseId, open, onOpenChange, onEdit }: CourseDetailSheetProps) {
  const router = useRouter();
  const { can } = useRbac();
  const canViewCurriculum = can("curriculum.view");
  const canViewAssessments = can("assessment_pool.view");
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [courseContents, setCourseContents] = useState<CourseContentSummary[]>([]);
  const [courseFolders, setCourseFolders] = useState<CourseFolderSummary[]>([]);
  const [assignedCourseContents, setAssignedCourseContents] = useState<CourseContentSummary[]>([]);
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !courseId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setCurricula([]);
    setAssessments([]);

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
  }, [canViewAssessments, canViewCurriculum, courseId, open]);

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

  const totalContentCount = rootContents.length + folderSections.reduce((sum, section) => sum + section.contents.length, 0);
  const assignedContentCount = assignedCourseContents.length;
  const curriculumCount = curricula.length;
  const assessmentCount = assessments.length;

  const openWorkspace = (pathname: string) => {
    router.push(pathname);
  };

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
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
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
                <div>
                  <SheetTitle>{course.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Top-level course grouping
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={getCourseStatusBadgeVariant(course.status)}>{getCourseStatusLabel(course.status)}</Badge>
                    <Badge variant={course.isActive ? "success" : "danger"}>{course.isActive ? "Active" : "Inactive"}</Badge>
                    <Badge variant="info">{course.programs.length} programs</Badge>
                    <Badge variant="info">{course.trainers.length} trainers</Badge>
                    {canViewCurriculum ? <Badge variant="info">{curriculumCount} curricula</Badge> : null}
                    {canViewAssessments ? <Badge variant="info">{assessmentCount} assessments</Badge> : null}
                    <Badge variant="info">{totalContentCount} content items</Badge>
                    <Badge variant="info">{assignedContentCount} assigned items</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Lifecycle</p>
                <p className="mt-3 text-sm font-semibold text-slate-900">{getCourseStatusLabel(course.status)}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{getCourseStatusDescription(course.status)}</p>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Description</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{course.description ?? "No description provided."}</p>
              </div>

              {canViewCurriculum ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Curriculum ({curriculumCount})</p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openWorkspace(`/curriculum-builder?courseId=${encodeURIComponent(course.id)}`)}
                      >
                        Open Builder
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
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assessments ({assessmentCount})</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openWorkspace(`/assessments?courseId=${encodeURIComponent(course.id)}`)}
                    >
                      Open Assessments
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
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                      Content Structure ({totalContentCount})
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openWorkspace(`/course-builder/repository?course=${encodeURIComponent(course.id)}`)}
                  >
                    Open Repository
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-slate-500" />
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
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Trainers ({course.trainers.length})</p>
                </div>
                {course.trainers.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {course.trainers.map((trainer) => (
                      <span key={trainer.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {trainer.fullName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No trainers are mapped to this course yet.</p>
                )}
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Programs ({course.programs.length})</p>
                </div>
                {course.programs.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {course.programs.map((program) => (
                      <div key={program.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{program.name}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{program.type}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No programs are mapped to this course yet.</p>
                )}
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="courses.edit">
                <Button onClick={() => onEdit(course.id)}>Edit Course</Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}