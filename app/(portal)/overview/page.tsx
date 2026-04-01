import { Suspense } from "react";

import { SectionPageSkeleton } from "@/components/modules/page-skeletons";
import { ProgramTreeView } from "@/components/modules/programs/program-tree-view";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Academy Overview</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-950">Program Hierarchy</h1>
        <p className="mt-1 text-sm text-slate-500">Programs, batches, trainers and candidates in a single view.</p>
      </div>
      <Suspense fallback={<SectionPageSkeleton />}>
        <ProgramTreeView />
      </Suspense>
    </div>
  );
}
