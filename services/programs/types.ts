import { ProgramType } from "@prisma/client";

export type ProgramOption = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

export type ProgramCreateResult = {
  id: string;
  courseId: string;
  courseName: string;
  slug: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
};

export type ProgramDetail = ProgramCreateResult;

export type ProgramRecord = {
  id: string;
  courseId: string;
  slug: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
  course: {
    name: string;
  };
};

export type ProgramSummaryRecord = {
  id: string;
  courseId: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
  course: {
    name: string;
  };
};
