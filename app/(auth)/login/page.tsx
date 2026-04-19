"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Briefcase,
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  X,
} from "lucide-react";

import { SESSION_EXPIRY_QUERY_KEY } from "@/components/layout/session-expiry-warning";

type ViewState = "SIGN_IN" | "TWO_STEP" | "RECOVERY" | "FORGOT_PASSWORD" | "RESET_SENT";

function resolvePostLoginPath(candidatePath: string | null) {
  if (!candidatePath || !candidatePath.startsWith("/") || candidatePath.startsWith("//")) {
    return "/dashboard";
  }

  return candidatePath;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState<ViewState>("SIGN_IN");
  const [showPassword, setShowPassword] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [twoFactorHint, setTwoFactorHint] = useState("");

  const postLoginPath = useMemo(() => resolvePostLoginPath(searchParams.get("next")), [searchParams]);
  const infoMessage = useMemo(() => {
    if (searchParams.get("reason") === "session-expired") {
      return "Your session expired. Sign in again to continue.";
    }

    if (searchParams.get("activated") === "1") {
      return "Your account is active. Sign in to continue.";
    }

    return "";
  }, [searchParams]);

  const completeSignIn = async () => {
    // Clear stale session-expiry cache so the warning component picks up
    // the new session cookie on the next fetch instead of using old data
    // that would trigger an immediate redirect loop.
    queryClient.removeQueries({ queryKey: [...SESSION_EXPIRY_QUERY_KEY] });
    router.replace(postLoginPath);
    router.refresh();
  };

  const resendTwoFactorCode = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/resend", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as { data?: { maskedEmail?: string }; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to resend the verification code right now.");
      }

      setTwoFactorHint(payload?.data?.maskedEmail ?? twoFactorHint);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to resend the verification code right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitialSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginId,
          password,
          rememberMe,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: { requiresTwoFactor?: boolean; maskedEmail?: string }; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to sign in right now. Please try again.");
      }

      if (payload?.data?.requiresTwoFactor) {
        setTwoFactorHint(payload.data.maskedEmail ?? "");
        setAuthCode("");
        setRecoveryCode("");
        setIsVerified(false);
        setViewState("TWO_STEP");
        return;
      }

      await completeSignIn();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (val: string) => {
    setAuthCode(val);
    setError("");
    setIsVerified(val.trim().length === 6);
  };

  const handleTwoStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: authCode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to verify your code right now.");
      }

      await completeSignIn();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify your code right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryChange = (val: string) => {
    setRecoveryCode(val);
    setError("");
    setIsVerified(val.trim().length > 0);
  };

  const handleRecoveryLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryCode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to verify your recovery code right now.");
      }

      await completeSignIn();
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : "Unable to verify your recovery code right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: resetEmail,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send password reset instructions right now.");
      }

      setViewState("RESET_SENT");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send password reset instructions right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetToSignIn = () => {
    setViewState("SIGN_IN");
    setAuthCode("");
    setRecoveryCode("");
    setTwoFactorHint("");
    setResetEmail("");
    setIsVerified(false);
    setError("");
  };

  const switchToRecovery = () => {
    setViewState("RECOVERY");
    setAuthCode("");
    setError("");
    setIsVerified(false);
  };

  const cancelRecovery = () => {
    setViewState("TWO_STEP");
    setRecoveryCode("");
    setError("");
    setIsVerified(false);
  };

  const getTwoStepTitle = () => "Email Verification";

  const getRecoveryTitle = () => "Recovery Verification";

  return (
    <div className="flex h-screen w-full flex-col bg-white md:flex-row">
      <div className="relative hidden w-[40%] flex-col items-start justify-center overflow-hidden bg-[#0D3B84] p-16 text-white md:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: "url('/api/branding/login-page-banner')",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(13,59,132,0.72),rgba(13,59,132,0.9))]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="z-20 mx-auto w-full max-w-lg">
          <div className="mb-12">
            <div className="inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
              <img
                src="/api/branding/application-logo"
                alt="Global Talent Square Logo"
                className="h-16 object-contain"
              />
            </div>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight lg:text-5xl">Global Talent Square Academy</h1>
          <p className="text-lg font-light leading-relaxed opacity-90">
            One platform, infinite possibilities. Empowering you with the skills and connections to thrive in the global talent ecosystem. Join us and unlock your potential today.
          </p>
          <div className="mt-20 border-t border-white border-opacity-20 pt-8">
            <div className="mb-3 flex space-x-6 text-white text-opacity-80">
              <Globe className="h-5 w-5" />
              <Briefcase className="h-5 w-5" />
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Secure. Compliant. Enterprise-ready.</p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-[#F6F7F9] p-4 sm:p-8 md:w-[60%]">
        {viewState !== "RECOVERY" ? (
          <div className="relative z-20 w-full max-w-md animate-fade-in rounded-xl border border-gray-200 bg-white p-6 shadow-xl sm:p-10">
            {viewState === "SIGN_IN" && (
              <>
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Signing into Global Talent Square</h2>
                <p className="mb-6 mt-1 text-sm text-gray-500">Enter your credentials to continue</p>
                {infoMessage ? <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#0d3b84]">{infoMessage}</p> : null}
                <form onSubmit={handleInitialSignIn} className="space-y-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400">Login ID</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        className="w-full rounded-xl border border-[#DDE1E6] bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm transition duration-150 focus:border-[#0D3B84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="example@gtis.com"
                      />
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <Mail className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-[#DDE1E6] bg-gray-50/50 py-2.5 pl-10 pr-10 text-sm transition duration-150 focus:border-[#0D3B84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="********"
                      />
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition duration-150 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-xs font-semibold text-gray-500">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border border-[#DDE1E6] text-[#0D3B84] focus:ring-[#0D3B84]"
                    />
                    Remember me for 30 days
                  </label>
                  {error && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-center text-xs font-bold text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center rounded-xl bg-[#0D3B84] py-3 text-sm font-bold text-white shadow-lg transition duration-200 active:scale-95 disabled:opacity-50 hover:bg-[#0a2e6b]"
                  >
                    {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "Sign In"}
                  </button>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = loginId.trim() ? `/forgot-password?email=${encodeURIComponent(loginId.trim())}` : "/forgot-password";
                        router.push(target);
                      }}
                      className="text-xs font-bold text-[#0D3B84] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </>
            )}

            {viewState === "TWO_STEP" && (
              <div className="animate-fade-in">
                <button
                  onClick={resetToSignIn}
                  className="mb-4 flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-[#0D3B84]"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to Login
                </button>
                <h2 className="mb-2 text-xl font-bold leading-tight text-gray-900">{getTwoStepTitle()}</h2>
                <p className="mb-8 text-sm font-medium leading-relaxed text-gray-500">
                  Please confirm access to your account and enter the verification code sent to your registered email address.
                </p>
                {twoFactorHint ? <p className="mb-6 text-xs font-semibold uppercase tracking-[0.12em] text-[#0D3B84]">Code sent to {twoFactorHint}</p> : null}
                <form onSubmit={handleTwoStepSubmit} className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Verification Code</label>
                      <button
                        type="button"
                        onClick={switchToRecovery}
                        className="text-[11px] font-bold text-[#0D3B84] hover:underline"
                      >
                        use a recovery code
                      </button>
                    </div>
                    <input
                      type="text"
                      value={authCode}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className={`w-full rounded-xl border-2 px-4 py-3 text-center text-lg font-black tracking-[0.5em] transition duration-150 focus:outline-none ${
                        isVerified
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-[#DDE1E6] bg-gray-50 focus:border-[#0D3B84]"
                      }`}
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                  {error && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-center text-xs font-bold text-red-600">{error}</p>}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={resendTwoFactorCode}
                      className="text-[11px] font-bold text-[#0D3B84] hover:underline"
                    >
                      resend code
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center rounded-xl bg-[#0D3B84] py-3.5 text-sm font-black text-white shadow-xl transition duration-200 active:scale-95 hover:bg-[#092d63]"
                  >
                    {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "Sign In"}
                  </button>
                </form>
              </div>
            )}

            {viewState === "FORGOT_PASSWORD" && (
              <div className="animate-fade-in">
                <button
                  onClick={resetToSignIn}
                  className="mb-4 flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-[#0D3B84]"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to Login
                </button>
                <h2 className="text-2xl font-semibold text-gray-900">Forgot Password</h2>
                <p className="mb-8 mt-1 text-sm text-gray-500">Enter your registered email address to receive a reset link.</p>
                <form onSubmit={handleSendResetLink} className="space-y-6">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full rounded-xl border border-[#DDE1E6] py-2.5 pl-10 pr-4 text-sm transition duration-150 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="example@gtis.com"
                      />
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <Mail className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center rounded-xl bg-[#0D3B84] py-3 text-sm font-bold text-white shadow-lg transition duration-200 hover:bg-[#092d63]"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
              </div>
            )}

            {viewState === "RESET_SENT" && (
              <div className="animate-fade-in py-4 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">Reset link sent!</h2>
                <p className="mb-10 mt-4 text-sm leading-relaxed text-gray-500">
                  We have sent a reset link to your email address. Please follow the instructions to update your password.
                </p>
                <button
                  type="button"
                  onClick={resetToSignIn}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D3B84] py-3 text-sm font-bold text-white shadow-md transition duration-200 hover:bg-[#092d63]"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
              </div>
            )}
            <div className="mt-8 pt-4 text-center">
              <a href="#" className="mx-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#0D3B84]">
                Privacy Policy
              </a>
              <span className="text-xs text-gray-200">|</span>
              <a href="#" className="mx-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#0D3B84]">
                Terms of Use
              </a>
            </div>
          </div>
        ) : (
          <div className="relative z-20 w-full max-w-lg animate-fade-in rounded-xl border border-gray-200 bg-white p-10 text-gray-900 shadow-2xl">
            <div className="mb-10 text-center">
              <h3 className="mb-2 text-xl font-bold text-gray-600">{getRecoveryTitle()}</h3>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#0D3B84]">Two Factor Challenge</h2>
              <p className="mx-auto mt-6 max-w-sm text-sm font-medium leading-relaxed text-gray-500">
                Enter one of your recovery codes if you cannot access the verification email for this account.
              </p>
            </div>
            <div className="space-y-8">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Recovery Code<span className="ml-0.5 text-red-500">*</span>
                  </label>
                  <button
                    onClick={cancelRecovery}
                    className="text-xs font-black uppercase tracking-widest text-[#0D3B84] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => handleRecoveryChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-base font-bold tracking-widest text-gray-900 transition-all placeholder-gray-400 focus:border-[#0D3B84] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="abcdef-98765"
                  />
                  {recoveryCode && (
                    <button
                      onClick={() => setRecoveryCode("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
              {error && <p className="rounded-lg border border-red-100 bg-red-50 p-2 text-center text-xs font-bold text-red-500">{error}</p>}
              <div className="flex justify-center">
                <button
                  onClick={handleRecoveryLogin}
                  disabled={isLoading}
                  className="flex w-full max-w-[240px] items-center justify-center rounded-xl bg-[#0D3B84] py-3.5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-900/10 transition-all disabled:opacity-50 hover:bg-[#0a2e6b]"
                >
                  {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "Sign In"}
                </button>
              </div>
            </div>
            <div className="mt-10 border-t border-gray-50 pt-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Secure Verification Portal</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
