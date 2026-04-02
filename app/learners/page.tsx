import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentCandidateSession } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";

export default async function LearnerPortalPage() {
  const session = await requireCurrentCandidateSession();

  const learner = await prisma.learner.findUnique({
    where: { id: session.learnerId },
    select: {
      fullName: true,
      learnerCode: true,
      email: true,
      status: true,
      readinessPercentage: true,
      placementStatus: true,
      latestAttendancePercentage: true,
      latestAssessmentAverage: true,
    },
  });

  if (!learner) {
    redirect("/learners/login");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[32px] bg-[linear-gradient(135deg,var(--primary-blue),#184f9b)] p-8 text-white shadow-[0_24px_60px_rgba(13,59,132,0.18)]">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/70">Learner Portal</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Welcome back, {learner.fullName}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80">This portal is restricted to your own learner record and progress indicators.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Learner Code" value={learner.learnerCode} />
          <StatCard title="Readiness" value={`${learner.readinessPercentage}%`} />
          <StatCard title="Attendance" value={`${Number(learner.latestAttendancePercentage).toFixed(1)}%`} />
          <StatCard title="Assessment Avg" value={`${Number(learner.latestAssessmentAverage).toFixed(0)}/100`} />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black text-slate-950">Profile Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Email</p>
              <p className="mt-2 font-semibold text-slate-900">{learner.email}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Status</p>
              <p className="mt-2 font-semibold text-slate-900">{learner.status}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Placement Status</p>
              <p className="mt-2 font-semibold text-slate-900">{learner.placementStatus}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Access Scope</p>
              <p className="mt-2 font-semibold text-slate-900">Only your learner record is available in this portal.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-2 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
        <p className="text-2xl font-black text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}