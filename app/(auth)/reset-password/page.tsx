"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const isTokenFlow = token.length > 0;

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const headline = useMemo(
    () => (isTokenFlow ? "Set your new password" : "Change your temporary password"),
    [isTokenFlow],
  );

  const description = useMemo(
    () =>
      isTokenFlow
        ? "Enter a new password to complete the reset process."
        : "Your account requires a password change before you can access the dashboard.",
    [isTokenFlow],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!password.trim() || password.trim().length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isTokenFlow && !currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(isTokenFlow ? "/api/auth/password-reset/confirm" : "/api/auth/password/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isTokenFlow
            ? {
                token,
                password,
              }
            : {
                currentPassword,
                password,
              },
        ),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update the password right now.");
      }

      setIsComplete(true);

      if (!isTokenFlow) {
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update the password right now.");
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
              <h1 className="text-2xl font-bold text-slate-950">Password updated</h1>
              <p className="mt-2 text-sm text-slate-500">
                {isTokenFlow
                  ? "Your password was updated successfully. You can sign in with the new password now."
                  : "Your password was updated successfully. Redirecting you to the dashboard."}
              </p>
            </div>
            {isTokenFlow ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-[#0b326f]"
              >
                Return to sign in
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mb-8 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#0d3b84]">
                {isTokenFlow ? <KeyRound className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">{headline}</h1>
                <p className="mt-2 text-sm text-slate-500">{description}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isTokenFlow ? (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-xl border border-[#dde1e6] bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-[#0d3b84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter your temporary password"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[#dde1e6] bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-[#0d3b84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-[#dde1e6] bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-[#0d3b84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Re-enter the new password"
                />
              </div>

              {error ? <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0d3b84] text-sm font-bold text-white transition-colors hover:bg-[#0b326f] disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Update password"}
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