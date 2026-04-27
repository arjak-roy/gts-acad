import type { FilterConfig } from "@/components/ui/data-table-filter-bar";

/**
 * Curated, section-specific filter configurations for LMS entities.
 * These are merged with (and take priority over) auto-derived column filters.
 */

export const COURSE_FILTERS: FilterConfig[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "ACTIVE" },
      { label: "Draft", value: "DRAFT" },
      { label: "Archived", value: "ARCHIVED" },
    ],
  },
];

export const PROGRAM_FILTERS: FilterConfig[] = [
  {
    key: "type",
    label: "Program Type",
    type: "select",
    options: [
      { label: "Nursing", value: "NURSING" },
      { label: "Technical", value: "TECHNICAL" },
      { label: "Language", value: "LANGUAGE" },
      { label: "Allied Health", value: "ALLIED_HEALTH" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" },
    ],
  },
];

export const BATCH_FILTERS: FilterConfig[] = [
  {
    key: "status",
    label: "Batch Status",
    type: "select",
    options: [
      { label: "Active", value: "ACTIVE" },
      { label: "Upcoming", value: "UPCOMING" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

export const TRAINER_FILTERS: FilterConfig[] = [
  {
    key: "specialization",
    label: "Specialization",
    type: "text",
  },
];

export const ASSESSMENT_FILTERS: FilterConfig[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Published", value: "PUBLISHED" },
      { label: "Draft", value: "DRAFT" },
      { label: "Archived", value: "ARCHIVED" },
    ],
  },
  {
    key: "questionType",
    label: "Question Type",
    type: "select",
    options: [
      { label: "MCQ", value: "MCQ" },
      { label: "True/False", value: "TRUE_FALSE" },
      { label: "Short Answer", value: "SHORT_ANSWER" },
      { label: "Essay", value: "ESSAY" },
      { label: "Speaking", value: "SPEAKING" },
    ],
  },
  {
    key: "difficulty",
    label: "Difficulty",
    type: "select",
    options: [
      { label: "Easy", value: "EASY" },
      { label: "Medium", value: "MEDIUM" },
      { label: "Hard", value: "HARD" },
    ],
  },
];

export const LEARNING_RESOURCE_FILTERS: FilterConfig[] = [
  {
    key: "contentType",
    label: "Resource Type",
    type: "select",
    options: [
      { label: "Article", value: "ARTICLE" },
      { label: "Document", value: "DOCUMENT" },
      { label: "Video", value: "VIDEO" },
      { label: "Audio", value: "AUDIO" },
      { label: "Presentation", value: "PRESENTATION" },
      { label: "Spreadsheet", value: "SPREADSHEET" },
      { label: "Image", value: "IMAGE" },
      { label: "Link", value: "LINK" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Published", value: "PUBLISHED" },
      { label: "Draft", value: "DRAFT" },
      { label: "Archived", value: "ARCHIVED" },
    ],
  },
  {
    key: "visibility",
    label: "Visibility",
    type: "select",
    options: [
      { label: "Public", value: "PUBLIC" },
      { label: "Private", value: "PRIVATE" },
      { label: "Restricted", value: "RESTRICTED" },
    ],
  },
];

/**
 * Returns the curated filter configs for a given portal section key.
 * Returns undefined if no curated filters are defined (falls back to auto-derived).
 */
export function getSectionFilterConfigs(sectionKey: string): FilterConfig[] | undefined {
  switch (sectionKey) {
    case "courses":
      return COURSE_FILTERS;
    case "programs":
      return PROGRAM_FILTERS;
    case "batches":
      return BATCH_FILTERS;
    case "trainers":
      return TRAINER_FILTERS;
    case "assessments":
      return ASSESSMENT_FILTERS;
    case "course-builder":
      return LEARNING_RESOURCE_FILTERS;
    default:
      return undefined;
  }
}
