"use client";

import { useEffect, useMemo, useState } from "react";

import { AssessmentReviewDetailSheet } from "@/components/modules/assessment-reviews/assessment-review-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSESSMENT_ATTEMPT_STATUS_LABELS, type AssessmentReviewQueueItem } from "@/services/assessment-reviews/types";

type QueueStatusFilter = "ALL" | "PENDING_REVIEW" | "IN_REVIEW" | "GRADED";

function getStatusBadgeVariant(status: AssessmentReviewQueueItem["status"]) {
  if (status === "GRADED") {
    return "success" as const;
  }

  if (status === "IN_REVIEW") {
    return "warning" as const;
  }

  return "info" as const;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString();
}

export function AssessmentReviewWorkspace() {
  const [items, setItems] = useState<AssessmentReviewQueueItem[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QueueStatusFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let active = true;

    const loadQueue = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (status !== "ALL") {
          params.set("status", status);
        }

        const response = await fetch(`/api/assessment-reviews?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewQueueItem[]; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load the assessment review queue.");
        }

        if (active) {
          setItems(payload?.data ?? []);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load the assessment review queue.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadQueue();

    return () => {
      active = false;
    };
  }, [refreshNonce, search, status]);

  const summary = useMemo(() => ({
    pending: items.filter((item) => item.status === "PENDING_REVIEW").length,
    inReview: items.filter((item) => item.status === "IN_REVIEW").length,
    graded: items.filter((item) => item.status === "GRADED").length,
    manual: items.filter((item) => item.requiresManualReview).length,
  }), [items]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : summary.pending}</div>
            <p className="text-xs text-slate-500">Attempts waiting for a trainer to pick them up</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">In Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : summary.inReview}</div>
            <p className="text-xs text-slate-500">Attempts currently being worked by a reviewer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Graded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : summary.graded}</div>
            <p className="text-xs text-slate-500">Attempts with a final recorded score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Manual Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : summary.manual}</div>
            <p className="text-xs text-slate-500">Attempts containing essay or reasoning questions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by learner, batch, assessment title, or code..."
            />
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={status}
              onChange={(event) => setStatus(event.target.value as QueueStatusFilter)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="GRADED">Graded</option>
            </select>
            <Button variant="secondary" onClick={() => setRefreshNonce((currentValue) => currentValue + 1)}>
              Refresh
            </Button>
          </div>

          {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600">{error}</div> : null}

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      No attempts matched the current review queue filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900">{item.learnerName}</p>
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.learnerCode}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900">{item.assessmentTitle}</p>
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.assessmentCode}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.batchName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getStatusBadgeVariant(item.status)}>{ASSESSMENT_ATTEMPT_STATUS_LABELS[item.status]}</Badge>
                          {item.requiresManualReview ? <Badge variant="warning">Manual Review</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{formatDateTime(item.submittedAt)}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {item.marksObtained === null ? "Pending" : `${item.marksObtained}/${item.totalMarks}`}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{item.reviewerName ?? "Unassigned"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="secondary" size="sm" onClick={() => setSelectedAttemptId(item.id)}>
                          Open Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AssessmentReviewDetailSheet
        attemptId={selectedAttemptId}
        open={Boolean(selectedAttemptId)}
        onOpenChange={(open) => !open && setSelectedAttemptId(null)}
        onUpdated={() => setRefreshNonce((currentValue) => currentValue + 1)}
      />
    </div>
  );
}