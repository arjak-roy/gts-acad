"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthIssue = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  moduleId?: string | null;
  stageId?: string | null;
  itemId?: string | null;
};

type HealthReport = {
  curriculumId: string;
  curriculumTitle: string;
  status: string;
  summary: {
    moduleCount: number;
    stageCount: number;
    itemCount: number;
    issueCount: number;
    highSeverityCount: number;
  };
  issues: HealthIssue[];
};

export function CurriculumHealthBadge({
  curriculumId,
  className,
}: {
  curriculumId: string;
  className?: string;
}) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!curriculumId) return;
    setIsLoading(true);
    fetch(`/api/curriculum/${curriculumId}/health`)
      .then((r) => r.json())
      .then((res: { data?: HealthReport }) => setReport(res.data ?? null))
      .catch(() => setReport(null))
      .finally(() => setIsLoading(false));
  }, [curriculumId]);

  if (isLoading) {
    return <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-slate-300", className)} />;
  }

  if (!report) return null;

  const { issueCount, highSeverityCount } = report.summary;

  if (issueCount === 0) {
    return (
      <Badge variant="default" className={cn("gap-1 text-[10px]", className)}>
        <CheckCircle2 className="h-3 w-3" />
        Healthy
      </Badge>
    );
  }

  if (highSeverityCount > 0) {
    return (
      <Badge variant="warning" className={cn("gap-1 bg-red-50 text-[10px] text-red-700", className)}>
        <AlertCircle className="h-3 w-3" />
        {highSeverityCount} critical
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className={cn("gap-1 text-[10px]", className)}>
      <AlertTriangle className="h-3 w-3" />
      {issueCount} issue{issueCount !== 1 ? "s" : ""}
    </Badge>
  );
}

export function CurriculumHealthReport({
  curriculumId,
  className,
}: {
  curriculumId: string;
  className?: string;
}) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!curriculumId) return;
    setIsLoading(true);
    fetch(`/api/curriculum/${curriculumId}/health`)
      .then((r) => r.json())
      .then((res: { data?: HealthReport }) => setReport(res.data ?? null))
      .catch(() => setReport(null))
      .finally(() => setIsLoading(false));
  }, [curriculumId]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!report || report.summary.issueCount === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        <p className="text-sm font-medium text-slate-700">No issues found</p>
        <p className="text-xs text-slate-400">This curriculum passes all health checks.</p>
      </div>
    );
  }

  const severityIcon = {
    high: <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />,
    medium: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />,
    low: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />,
  };

  const severityBg = {
    high: "bg-red-50 border-red-100",
    medium: "bg-amber-50 border-amber-100",
    low: "bg-slate-50 border-slate-100",
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-slate-700">
          {report.summary.issueCount} issue{report.summary.issueCount !== 1 ? "s" : ""} found
        </p>
        {report.summary.highSeverityCount > 0 && (
          <Badge variant="warning" className="bg-red-50 text-[10px] text-red-700">
            {report.summary.highSeverityCount} critical
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {report.issues.map((issue, index) => (
          <div
            key={`${issue.code}-${index}`}
            className={cn("flex items-start gap-2 rounded-xl border p-2.5", severityBg[issue.severity])}
          >
            {severityIcon[issue.severity]}
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800">{issue.message}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{issue.code}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
