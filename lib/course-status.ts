import { CourseStatus } from "@/types";

export type CourseStatusOption = {
  value: CourseStatus;
  label: string;
  description: string;
};

export const COURSE_STATUS_OPTIONS: CourseStatusOption[] = [
  {
    value: CourseStatus.DRAFT,
    label: "Draft",
    description: "Course structure is still being assembled and reviewed internally.",
  },
  {
    value: CourseStatus.IN_REVIEW,
    label: "In Review",
    description: "Course is waiting for approval before it can be published to the LMS.",
  },
  {
    value: CourseStatus.PUBLISHED,
    label: "Published",
    description: "Course is approved and ready to power programs, content, and quizzes.",
  },
  {
    value: CourseStatus.ARCHIVED,
    label: "Archived",
    description: "Course is retired from active planning and delivery.",
  },
];

export const COURSE_STATUS_ORDER: Record<CourseStatus, number> = {
  [CourseStatus.PUBLISHED]: 0,
  [CourseStatus.IN_REVIEW]: 1,
  [CourseStatus.DRAFT]: 2,
  [CourseStatus.ARCHIVED]: 3,
};

export function getCourseStatusLabel(status: CourseStatus) {
  return COURSE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function getCourseStatusDescription(status: CourseStatus) {
  return COURSE_STATUS_OPTIONS.find((option) => option.value === status)?.description ?? "";
}

export function getCourseStatusBadgeVariant(status: CourseStatus) {
  switch (status) {
    case CourseStatus.PUBLISHED:
      return "success" as const;
    case CourseStatus.IN_REVIEW:
      return "warning" as const;
    case CourseStatus.ARCHIVED:
      return "danger" as const;
    default:
      return "default" as const;
  }
}

export function getCourseStatusAccent(status: CourseStatus) {
  switch (status) {
    case CourseStatus.PUBLISHED:
      return "bg-emerald-500";
    case CourseStatus.IN_REVIEW:
      return "bg-amber-500";
    case CourseStatus.ARCHIVED:
      return "bg-rose-400";
    default:
      return "bg-slate-500";
  }
}