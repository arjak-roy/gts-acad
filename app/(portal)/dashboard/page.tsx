import { Suspense } from "react";

import { getDashboardStats, searchDashboard } from "@/app/actions/dashboard";
import { DashboardPageSkeleton } from "@/components/modules/page-skeletons";
import { DashboardOverview } from "@/components/modules/dashboard/dashboard-overview";
import { getCourseStatusLabel } from "@/lib/course-status";
import { listCoursesService } from "@/services/courses-service";
import { listProgramsService } from "@/services/programs-service";
import { listDashboardBatchOptionsService } from "@/services/dashboard-service";
import { ProgramType } from "@/types";

const dashboardCategoryOptions = [
  { id: ProgramType.LANGUAGE, label: "Language" },
  { id: ProgramType.CLINICAL, label: "Clinical" },
  { id: ProgramType.TECHNICAL, label: "Technical" },
];

type DashboardPageProps = {
  searchParams?: {
    query?: string;
    programType?: ProgramType;
    courseId?: string;
    programId?: string;
    batchId?: string;
  };
};

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardPageContent({ searchParams }: DashboardPageProps) {
  const searchQuery = searchParams?.query?.trim() ?? "";
  const rawProgramType = searchParams?.programType?.trim() || undefined;
  const programType = rawProgramType && Object.values(ProgramType).includes(rawProgramType as ProgramType)
    ? (rawProgramType as ProgramType)
    : undefined;
  const courseId = searchParams?.courseId?.trim() || undefined;
  const programId = searchParams?.programId?.trim() || undefined;
  const batchId = searchParams?.batchId?.trim() || undefined;

  const [stats, searchResults, courses, programs, batches] = await Promise.all([
    getDashboardStats({ programType, courseId, programId, batchId }),
    searchQuery ? searchDashboard({ query: searchQuery }) : Promise.resolve(null),
    listCoursesService(),
    listProgramsService(),
    listDashboardBatchOptionsService({ programType, courseId, programId }),
  ]);

  return (
    <DashboardOverview
      stats={stats}
      searchQuery={searchQuery}
      searchResults={searchResults}
      filterOptions={{
        categories: dashboardCategoryOptions,
        courses: courses.map((course) => ({
          id: course.id,
          label: course.name,
          helper: `${getCourseStatusLabel(course.status)} · ${course.programCount} program${course.programCount === 1 ? "" : "s"}`,
        })),
        programs: programs.map((program) => ({
          id: program.id,
          courseId: program.courseId,
          type: program.type,
          label: program.name,
          helper: `${program.courseName} · ${program.type}`,
        })),
        batches: batches.map((batch) => ({
          id: batch.id,
          courseId: batch.courseId,
          programId: batch.programId,
          programType: batch.programType,
          label: `${batch.code} · ${batch.name}`,
          helper: `${batch.programName} · ${batch.status}`,
        })),
      }}
    />
  );
}