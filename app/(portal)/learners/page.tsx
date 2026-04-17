import { Suspense } from "react";

import { getLearnerByCode, getLearners } from "@/app/actions/learners";
import { LearnerBulkImportCard } from "@/components/modules/learners/learner-bulk-import-card";
import { LearnerEditSheet } from "@/components/modules/learners/learner-edit-sheet";
import { LearnerSheet } from "@/components/modules/learners/learner-sheet";
import { LearnersTable } from "@/components/modules/learners/learners-table";
import { LearnersPageSkeleton } from "@/components/modules/page-skeletons";

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
    edit?: string;
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
  const filters = {
    page: searchParams?.page ?? "1",
    pageSize: searchParams?.pageSize ?? "10",
    search: searchParams?.search ?? "",
    batchCode: searchParams?.batchCode ?? "",
    placementStatus: searchParams?.placementStatus,
    sortBy: searchParams?.sortBy ?? "fullName",
    sortDirection: searchParams?.sortDirection ?? "asc",
  };

  const learnerPromise = searchParams?.id ? getLearnerByCode({ learnerCode: searchParams.id }) : Promise.resolve(null);
  const editLearnerPromise = searchParams?.edit
    ? searchParams.edit === searchParams.id
      ? learnerPromise
      : getLearnerByCode({ learnerCode: searchParams.edit })
    : Promise.resolve(null);

  const [response, learner, editLearner] = await Promise.all([getLearners(filters), learnerPromise, editLearnerPromise]);

  return (
    <div className="space-y-6">
      <LearnerBulkImportCard />
      <LearnersTable response={response} filters={filters} />
      <LearnerSheet learner={learner} />
      <LearnerEditSheet learner={editLearner} />
    </div>
  );
}