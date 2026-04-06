"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, MailCheck, ShieldAlert } from "lucide-react";

type ActivationState = "pending" | "success" | "error";

type ActivationResult = {
  email?: string;
  name?: string;
  loginUrl?: string;
};

function ActivateAccountPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const startedRef = useRef(false);

  const [state, setState] = useState<ActivationState>(token ? "pending" : "error");
  const [error, setError] = useState(token ? "" : "Activation token is missing.");
  const [result, setResult] = useState<ActivationResult>({ loginUrl: "/login" });
  const signInHref = result.loginUrl?.startsWith("/")
    ? `${result.loginUrl}${result.loginUrl.includes("?") ? "&" : "?"}activated=1`
    : (result.loginUrl ?? "/login");

  useEffect(() => {
    if (!token || startedRef.current) {
      return;
    }

    startedRef.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/auth/activate-account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const payload = (await response.json().catch(() => null)) as {
          data?: ActivationResult;
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to activate this account.");
        }

        setResult(payload?.data ?? { loginUrl: "/login" });
        setState("success");
      } catch (activationError) {
        setError(activationError instanceof Error ? activationError.message : "Unable to activate this account.");
        setState("error");
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#dde1e6] bg-white p-8 shadow-xl">
        {state === "pending" ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#0d3b84]">
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Activating your account</h1>
              <p className="mt-2 text-sm text-slate-500">We&apos;re validating your activation link and preparing your sign-in access.</p>
            </div>
          </div>
        ) : state === "success" ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Account activated</h1>
              <p className="mt-2 text-sm text-slate-500">
                {result.email ? `${result.email} is now active.` : "Your account is now active."} Sign in to continue.
              </p>
            </div>
            <a
              href={signInHref}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0d3b84] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0b326f]"
            >
              Continue to sign in
            </a>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <ShieldAlert className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Activation unavailable</h1>
              <p className="mt-2 text-sm text-slate-500">{error || "This activation link is invalid or has expired."}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm text-slate-500">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
                <MailCheck className="h-4 w-4 text-[#0d3b84]" />
                Need a fresh invite?
              </div>
              <p>Contact your academy administrator or support contact to resend your onboarding email.</p>
            </div>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[#0d3b84] hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
      <ActivateAccountPageContent />
    </Suspense>
  );
}