"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface AnalyticsFilterBarProps {
  courses: { id: string; name: string }[];
  programs: { id: string; name: string; courseId: string }[];
  batches: { id: string; name: string; programId: string }[];
  assessmentPools: { id: string; title: string; code: string }[];
  filters: AnalyticsFilterState;
  onChange: (filters: AnalyticsFilterState) => void;
}

export interface AnalyticsFilterState {
  courseId: string;
  programId: string;
  batchId: string;
  assessmentPoolId: string;
  dateFrom: string;
  dateTo: string;
}

const selectClassName =
  "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

export function AnalyticsFilterBar({
  courses,
  programs,
  batches,
  assessmentPools,
  filters,
  onChange,
}: AnalyticsFilterBarProps) {
  const filteredPrograms = useMemo(
    () => (filters.courseId ? programs.filter((p) => p.courseId === filters.courseId) : programs),
    [programs, filters.courseId],
  );

  const filteredBatches = useMemo(
    () => (filters.programId ? batches.filter((b) => b.programId === filters.programId) : batches),
    [batches, filters.programId],
  );

  const handleChange = useCallback(
    (key: keyof AnalyticsFilterState, value: string) => {
      const next = { ...filters, [key]: value };
      // cascade resets
      if (key === "courseId") {
        next.programId = "";
        next.batchId = "";
      }
      if (key === "programId") {
        next.batchId = "";
      }
      onChange(next);
    },
    [filters, onChange],
  );

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className={selectClassName}
        value={filters.courseId}
        onChange={(e) => handleChange("courseId", e.target.value)}
        style={{ maxWidth: 200 }}
      >
        <option value="">All Courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={filters.programId}
        onChange={(e) => handleChange("programId", e.target.value)}
        style={{ maxWidth: 200 }}
      >
        <option value="">All Programs</option>
        {filteredPrograms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={filters.batchId}
        onChange={(e) => handleChange("batchId", e.target.value)}
        style={{ maxWidth: 200 }}
      >
        <option value="">All Batches</option>
        {filteredBatches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={filters.assessmentPoolId}
        onChange={(e) => handleChange("assessmentPoolId", e.target.value)}
        style={{ maxWidth: 220 }}
      >
        <option value="">All Assessments</option>
        {assessmentPools.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} – {a.title}
          </option>
        ))}
      </select>

      <input
        type="date"
        className={selectClassName}
        value={filters.dateFrom}
        onChange={(e) => handleChange("dateFrom", e.target.value)}
        placeholder="From"
        style={{ maxWidth: 160 }}
      />
      <input
        type="date"
        className={selectClassName}
        value={filters.dateTo}
        onChange={(e) => handleChange("dateTo", e.target.value)}
        placeholder="To"
        style={{ maxWidth: 160 }}
      />
    </div>
  );
}
