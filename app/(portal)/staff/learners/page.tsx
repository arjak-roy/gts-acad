import { Suspense } from "react";

import { getLearnerByCode, getLearners } from "@/app/actions/learners";
import { AttendanceBulkForm } from "@/components/modules/learners/attendance-bulk-form";
import { LearnerSheet } from "@/components/modules/learners/learner-sheet";
import { LearnersTable } from "@/components/modules/learners/learners-table";
import { LearnersPageSkeleton } from "@/components/modules/page-skeletons";
import { requireCurrentAuthSession, requireModuleAccess } from "@/lib/auth/access";

type LearnersPageProps = {
  searchParams?: {
    page?: string;
    pageSize?: string;
    search?: string;
    batchCode?: string;
    placementStatus?: "NOT_READY" | "IN_REVIEW" | "PLACEMENT_READY";
    sortBy?: "fullName" | "attendancePercentage" | "averageScore" | "readinessPercentage";
    sortDirection?: "asc" | "desc";
    id?: string;
  };
};

export default function LearnersPage({ searchParams }: LearnersPageProps) {
  return (
    <Suspense fallback={<LearnersPageSkeleton />}>
      <LearnersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LearnersPageContent({ searchParams }: LearnersPageProps) {
  const session = await requireCurrentAuthSession();
  requireModuleAccess(session, "learners");

  const filters = {
    page: searchParams?.page ?? "1",
    pageSize: searchParams?.pageSize ?? "10",
    search: searchParams?.search ?? "",
    batchCode: searchParams?.batchCode ?? "",
    placementStatus: searchParams?.placementStatus,
    sortBy: searchParams?.sortBy ?? "fullName",
    sortDirection: searchParams?.sortDirection ?? "asc",
  };

  const [response, learner] = await Promise.all([
    getLearners(filters),
    searchParams?.id ? getLearnerByCode({ learnerCode: searchParams.id }) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <LearnersTable response={response} filters={filters} />
      <AttendanceBulkForm />
      <LearnerSheet learner={learner} />
    </div>
  );
}