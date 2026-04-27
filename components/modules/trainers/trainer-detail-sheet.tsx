"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Mail, Phone, Star, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import {
  TRAINER_AVAILABILITY_LABELS,
  type TrainerActivityItem,
  type TrainerActivityResponse,
  type TrainerDetail,
  type TrainerPerformanceSummary,
  type TrainerStatusHistoryItem,
} from "@/services/trainers/types";

type TrainerDetailSheetProps = {
  trainerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (trainerId: string) => void;
};

export function TrainerDetailSheet({ trainerId, open, onOpenChange, onEdit }: TrainerDetailSheetProps) {
  const [trainer, setTrainer] = useState<TrainerDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "activity" | "status-history">("overview");
  const [statusHistory, setStatusHistory] = useState<TrainerStatusHistoryItem[]>([]);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false);
  const [statusHistoryError, setStatusHistoryError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<TrainerPerformanceSummary | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [activity, setActivity] = useState<TrainerActivityItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !trainerId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setTrainer(null);
    setPerformance(null);
    setPerformanceError(null);
    setActivity([]);
    setActivityPage(1);
    setActivityTotal(0);
    setActivityError(null);
    setIsActivityLoading(false);
    setActiveTab("overview");

    Promise.all([
      fetch(`/api/trainers/${trainerId}`, { cache: "no-store" }),
      fetch(`/api/trainers/${trainerId}/performance`, { cache: "no-store" }),
    ])
      .then(async ([trainerResponse, performanceResponse]) => {
        const trainerPayload = (await trainerResponse.json().catch(() => null)) as { data?: TrainerDetail; error?: string } | null;
        const performancePayload = (await performanceResponse.json().catch(() => null)) as { data?: TrainerPerformanceSummary; error?: string } | null;

        if (!trainerResponse.ok) {
          throw new Error(trainerPayload?.error ?? "Failed to load trainer details.");
        }

        if (!performanceResponse.ok) {
          throw new Error(performancePayload?.error ?? "Failed to load trainer performance.");
        }

        if (active && trainerPayload?.data) {
          setTrainer(trainerPayload.data);
        }

        if (active) {
          setPerformance(performancePayload?.data ?? null);
        }
      })
      .catch((err) => {
        if (active) {
          const message = err instanceof Error ? err.message : "Failed to load trainer details.";
          setError(message);
          if (message.toLowerCase().includes("performance")) {
            setPerformanceError(message);
          }
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [trainerId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTrainer(null);
      setError(null);
      setPerformance(null);
      setPerformanceError(null);
      setActivity([]);
      setActivityPage(1);
      setActivityTotal(0);
      setActivityError(null);
      setIsActivityLoading(false);
      setStatusHistory([]);
      setStatusHistoryLoading(false);
      setStatusHistoryError(null);
      setActiveTab("overview");
    }
  };

  const loadActivity = useCallback(async (page: number, append: boolean) => {
    if (!trainerId) {
      return;
    }

    setIsActivityLoading(true);
    setActivityError(null);

    try {
      const response = await fetch(`/api/trainers/${trainerId}/activity?page=${page}&pageSize=10`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: TrainerActivityResponse; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load trainer activity.");
      }

      const items = payload?.data?.items ?? [];
      setActivity((current) => (append ? [...current, ...items] : items));
      setActivityPage(payload?.data?.page ?? page);
      setActivityTotal(payload?.data?.totalCount ?? 0);
    } catch (loadError) {
      setActivityError(loadError instanceof Error ? loadError.message : "Failed to load trainer activity.");
    } finally {
      setIsActivityLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    if (!open || !trainerId || activeTab !== "activity" || activity.length > 0 || isActivityLoading) {
      return;
    }

    void loadActivity(1, false);
  }, [activeTab, activity.length, isActivityLoading, loadActivity, open, trainerId]);
  useEffect(() => {
    if (!open || !trainerId || activeTab !== "status-history" || statusHistory.length > 0 || statusHistoryLoading) {
      return;
    }

    setStatusHistoryLoading(true);
    setStatusHistoryError(null);

    fetch(`/api/trainers/${trainerId}/status-history`, { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as { data?: TrainerStatusHistoryItem[]; error?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load status history.");
        }
        setStatusHistory(payload?.data ?? []);
      })
      .catch((err) => {
        setStatusHistoryError(err instanceof Error ? err.message : "Failed to load status history.");
      })
      .finally(() => {
        setStatusHistoryLoading(false);
      });
  }, [activeTab, open, statusHistory.length, statusHistoryLoading, trainerId]);

  const formatDate = (value: string | null) => {
    if (!value) {
      return "Never";
    }

    return new Date(value).toLocaleString();
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value == null) {
      return "0";
    }

    return value.toLocaleString();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : trainer ? (
          <>
            <SheetHeader>
                <div className="flex items-start gap-4">
                  {trainer.profilePhotoUrl ? (
                    <Image
                      src={trainer.profilePhotoUrl}
                      alt={trainer.fullName}
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700">
                      {trainer.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                  )}
                <div>
                  <SheetTitle>{trainer.fullName}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {trainer.specialization}
                  </SheetDescription>
                  <p className="mt-1 text-xs text-slate-500">
                    Last modified {formatDate(trainer.lastUpdatedAt)}{trainer.lastUpdatedByName ? ` by ${trainer.lastUpdatedByName}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={trainer.status === "ACTIVE" ? "success" : trainer.status === "SUSPENDED" ? "warning" : "danger"}>
                      {trainer.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                      activeTab === "overview" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
                    }`}
                    onClick={() => setActiveTab("overview")}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                      activeTab === "performance" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
                    }`}
                    onClick={() => setActiveTab("performance")}
                  >
                    Performance
                  </button>
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                      activeTab === "activity" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
                    }`}
                    onClick={() => setActiveTab("activity")}
                  >
                    Activity
                    </button>
                    <button
                      type="button"
                      className={`rounded-2xl px-2 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        activeTab === "status-history" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:bg-slate-100"
                      }`}
                      onClick={() => setActiveTab("status-history")}
                    >
                      History
                    </button>
                  </div>
              </div>

              {activeTab === "overview" ? (
                <>
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Contact</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-600">
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="font-semibold text-slate-900">Email</p>
                          <p>{trainer.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="font-semibold text-slate-900">Phone</p>
                          <p>{trainer.phone ?? "Not provided"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Employee Code</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{trainer.employeeCode}</p>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Specialization</p>
                      <div className="mt-3 flex items-start gap-3">
                        <UserRound className="mt-0.5 h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-slate-900">{trainer.specialization}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Capacity</p>
                      <div className="mt-3 flex items-start gap-3">
                        <Star className="mt-0.5 h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-slate-900">{trainer.capacity} learners</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Availability</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={trainer.availabilityStatus === "AVAILABLE" ? "success" : trainer.availabilityStatus === "LIMITED" ? "warning" : trainer.availabilityStatus === "UNAVAILABLE" ? "danger" : "info"}>
                          {TRAINER_AVAILABILITY_LABELS[trainer.availabilityStatus]}
                        </Badge>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Last Active</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{formatDate(trainer.lastActiveAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Courses</p>
                    {trainer.courses.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">No courses assigned.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {trainer.courses.map((course) => (
                          <Link
                            key={course}
                            href={`/courses?search=${encodeURIComponent(course)}`}
                            className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                          >
                            <BookOpen className="h-3 w-3" />
                            {course}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {trainer.bio ? (
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Bio</p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{trainer.bio}</p>
                    </div>
                  ) : null}
                                  {trainer.department || trainer.jobTitle ? (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                      {trainer.department ? (
                                        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Department</p>
                                          <p className="mt-3 text-sm font-semibold text-slate-900">{trainer.department}</p>
                                        </div>
                                      ) : null}
                                      {trainer.jobTitle ? (
                                        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Job Title</p>
                                          <p className="mt-3 text-sm font-semibold text-slate-900">{trainer.jobTitle}</p>
                                        </div>
                                      ) : null}
                                      {trainer.experienceYears != null ? (
                                        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Experience</p>
                                          <p className="mt-3 text-sm font-semibold text-slate-900">{trainer.experienceYears} {trainer.experienceYears === 1 ? "year" : "years"}</p>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {(trainer.skills?.length ?? 0) > 0 ? (
                                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Skills</p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {trainer.skills.map((skill) => (
                                          <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{skill}</span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {(trainer.certifications?.length ?? 0) > 0 ? (
                                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Certifications</p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {trainer.certifications.map((cert) => (
                                          <span key={cert} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{cert}</span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {trainer.bio ? (
                                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Bio</p>
                                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{trainer.bio}</p>
                                    </div>
                                  ) : null}
                </>
              ) : null}

              {activeTab === "performance" ? (
                performanceError ? (
                  <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600">{performanceError}</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Courses</p>
                      <p className="mt-3 text-2xl font-black text-slate-900">{formatNumber(performance?.assignedCourses)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Learners</p>
                      <p className="mt-3 text-2xl font-black text-slate-900">{formatNumber(performance?.numberOfLearners)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Completion Rate</p>
                      <p className="mt-3 text-2xl font-black text-slate-900">{formatNumber(performance?.completionRate)}%</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Average Score</p>
                      <p className="mt-3 text-2xl font-black text-slate-900">{formatNumber(performance?.averageLearnerScore)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Pending Reviews</p>
                      <p className="mt-3 text-2xl font-black text-slate-900">{formatNumber(performance?.pendingReviews)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Last Active</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{formatDate(performance?.lastActiveAt ?? null)}</p>
                    </div>
                  </div>
                )
              ) : null}

              {activeTab === "activity" ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Activity Timeline</p>
                  {activityError ? <p className="mt-3 text-sm font-semibold text-rose-600">{activityError}</p> : null}
                  {!activityError && activity.length === 0 && !isActivityLoading ? (
                    <p className="mt-3 text-sm text-slate-500">No recent activity recorded.</p>
                  ) : null}
                  <div className="mt-3 space-y-3">
                    {activity.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(item.occurredAt)}</p>
                      </div>
                    ))}
                  </div>
                  {isActivityLoading ? <p className="mt-3 text-xs font-semibold text-slate-500">Loading activity…</p> : null}
                  {!isActivityLoading && activity.length < activityTotal ? (
                    <Button className="mt-4" variant="secondary" onClick={() => void loadActivity(activityPage + 1, true)}>
                      Load More
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "status-history" ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Status Change History</p>
                  {statusHistoryError ? <p className="mt-3 text-sm font-semibold text-rose-600">{statusHistoryError}</p> : null}
                  {statusHistoryLoading ? <p className="mt-3 text-xs font-semibold text-slate-500">Loading history…</p> : null}
                  {!statusHistoryLoading && !statusHistoryError && statusHistory.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No status changes recorded.</p>
                  ) : null}
                  <div className="mt-3 space-y-3">
                    {statusHistory.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.oldStatus === "ACTIVE" ? "success" : item.oldStatus === "SUSPENDED" ? "warning" : "danger"}>
                            {item.oldStatus}
                          </Badge>
                          <span className="text-xs text-slate-400">→</span>
                          <Badge variant={item.newStatus === "ACTIVE" ? "success" : item.newStatus === "SUSPENDED" ? "warning" : "danger"}>
                            {item.newStatus}
                          </Badge>
                        </div>
                        {item.reason ? (
                          <p className="mt-1.5 text-xs text-slate-600">{item.reason}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(item.changedAt)}{item.changedByName ? ` · by ${item.changedByName}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="trainers.edit">
                <Button onClick={() => onEdit(trainer.id)}>
                  Edit Trainer
                </Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
