import { ProgramType } from "@prisma/client";

export type CourseProgramSummary = {
  id: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

export type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programCount: number;
};

export type CourseCreateResult = CourseOption;

export type CourseDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programs: CourseProgramSummary[];
};
