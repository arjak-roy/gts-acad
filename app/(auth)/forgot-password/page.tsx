"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

function ForgotPasswordPageContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email")?.trim() ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send password reset instructions right now.");
      }

      setIsComplete(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send password reset instructions right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#dde1e6] bg-white p-8 shadow-xl">
        {isComplete ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Reset instructions sent</h1>
              <p className="mt-2 text-sm text-slate-500">
                If an account exists for {email || "that email address"}, reset instructions are on the way.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0d3b84] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0b326f]"
            >
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#0d3b84]">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">Forgot your password?</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Enter your account email and we&apos;ll send secure reset instructions if the account exists.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[#dde1e6] bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-[#0d3b84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="name@example.com"
                />
              </div>

              {error ? <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0d3b84] text-sm font-bold text-white transition-colors hover:bg-[#0b326f] disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send reset instructions"}
              </button>
            </form>

            <div className="mt-6">
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[#0d3b84] hover:underline">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}