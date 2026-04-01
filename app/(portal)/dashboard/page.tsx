import { Suspense } from "react";

import { getDashboardStats, searchDashboard } from "@/app/actions/dashboard";
import { DashboardPageSkeleton } from "@/components/modules/page-skeletons";
import { DashboardOverview } from "@/components/modules/dashboard/dashboard-overview";

type DashboardPageProps = {
  searchParams?: {
    query?: string;
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

  const [stats, searchResults] = await Promise.all([
    getDashboardStats({}),
    searchQuery ? searchDashboard({ query: searchQuery }) : Promise.resolve(null),
  ]);

  return <DashboardOverview stats={stats} searchQuery={searchQuery} searchResults={searchResults} />;
}