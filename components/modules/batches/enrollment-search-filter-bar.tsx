"use client";

import type { FormEvent } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EnrollmentFilterCourseOption = {
  id: string;
  name: string;
};

export type EnrollmentFilterProgramOption = {
  id: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
};

type EnrollmentSearchFilterBarProps = {
  search: string;
  courseId: string;
  programId: string;
  courses: EnrollmentFilterCourseOption[];
  programs: EnrollmentFilterProgramOption[];
  matchCount: number;
  onSearchChange: (value: string) => void;
  onCourseChange: (courseId: string) => void;
  onProgramChange: (programId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function EnrollmentSearchFilterBar({
  search,
  courseId,
  programId,
  courses,
  programs,
  matchCount,
  onSearchChange,
  onCourseChange,
  onProgramChange,
  onSubmit,
}: EnrollmentSearchFilterBarProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Find Candidates to Enroll</p>
        <p className="text-sm font-semibold text-slate-700">Matches: {matchCount}</p>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <Input
          placeholder="Search by code, name, or email"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <select
            className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
            value={courseId}
            onChange={(event) => onCourseChange(event.target.value)}
          >
            <option value="">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
            value={programId}
            onChange={(event) => onProgramChange(event.target.value)}
          >
            <option value="">All programs</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.type})
              </option>
            ))}
          </select>

          <Button type="submit" variant="secondary" className="h-10">
            <Search className="mr-1 h-4 w-4" />
            Find
          </Button>
        </div>
      </form>
    </section>
  );
}
