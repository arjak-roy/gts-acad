import { CandidateLoginForm } from "@/components/modules/portal/candidate-login-form";

export default function LearnerLoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(248,154,28,0.22),transparent_26%),linear-gradient(180deg,rgba(13,59,132,0.08),transparent_30%),#f5f7fb] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="inline-flex rounded-full border border-[#0d3b84]/10 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#0d3b84] shadow-sm">GTS Academy Learner Access</div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Your training progress, attendance, and readiness in one secure portal.</h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">Sign in with your learner code and registered email address. This portal is separate from the admin and trainer workspace.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard title="Private access" copy="Learners can only reach learner-specific routes under the portal." />
            <FeatureCard title="Branded workflow" copy="Built with the academy's primary blue and accent orange visual language." />
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-4 rounded-[28px] bg-[linear-gradient(135deg,#0d3b84,#1853a7)] px-6 py-5 text-white shadow-[0_24px_60px_rgba(13,59,132,0.2)]">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/70">Learner Sign In</p>
            <p className="mt-2 text-sm text-white/80">Use the exact learner code shared during enrollment.</p>
          </div>
          <CandidateLoginForm />
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[26px] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="mb-3 h-2 w-16 rounded-full bg-[var(--accent-orange)]" />
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}