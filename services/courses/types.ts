import { CourseStatus, ProgramType } from "@prisma/client";

import type { AssignedSharedContentListItem } from "@/services/course-content/types";

export type CourseProgramSummary = {
  id: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

export type CourseTrainerSummary = {
  id: string;
  fullName: string;
  specialization: string;
};

export type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  status: CourseStatus;
  isActive: boolean;
  programCount: number;
};

export type CourseCreateResult = CourseOption;

export type CourseDetail = {
  id: string;
  name: string;
  description: string | null;
  status: CourseStatus;
  isActive: boolean;
  programs: CourseProgramSummary[];
  trainers: CourseTrainerSummary[];
  assignedSharedContents: AssignedSharedContentListItem[];
};
