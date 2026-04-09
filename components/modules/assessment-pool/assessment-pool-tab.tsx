"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Skeleton } from "@/components/ui/skeleton";

type PoolItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  courseName: string | null;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  status: string;
  isAiGenerated: boolean;
  questionCount: number;
  courseLinksCount: number;
  createdAt: string;
};

const questionTypeLabels: Record<string, string> = {
  MCQ: "Multiple Choice",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
};

const difficultyColors: Record<string, string> = {
  EASY: "text-green-600 bg-green-50 border-green-200",
  MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
  HARD: "text-red-600 bg-red-50 border-red-200",
};

const statusVariant: Record<string, "default" | "info" | "warning"> = {
  DRAFT: "info",
  PUBLISHED: "default",
  ARCHIVED: "warning",
};

export function AssessmentPoolTab({
  courseId,
  onAddAssessment,
  onSelectAssessment,
  onAiGenerate,
}: {
  courseId?: string;
  onAddAssessment: () => void;
  onSelectAssessment: (poolId: string) => void;
  onAiGenerate: () => void;
}) {
  const [pools, setPools] = useState<PoolItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");

  const fetchPools = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseId) params.set("courseId", courseId);
      if (filterType) params.set("questionType", filterType);
      if (filterDifficulty) params.set("difficultyLevel", filterDifficulty);

      const response = await fetch(`/api/assessment-pool?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load assessments.");
      const result = (await response.json()) as { data?: PoolItem[] };
      setPools(result.data ?? []);
    } catch {
      toast.error("Failed to load assessment pool.");
    } finally {
      setIsLoading(false);
    }
  }, [courseId, filterType, filterDifficulty]);

  useEffect(() => {
    void fetchPools();
  }, [fetchPools]);

  const published = pools.filter((p) => p.status === "PUBLISHED").length;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {pools.length} assessment{pools.length !== 1 ? "s" : ""} · {published} published
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Guided create opens the new assessment directly in question builder after save.</p>
        </div>
        <div className="flex gap-2">
          <CanAccess permission="assessment_pool.create">
            <Button size="sm" variant="secondary" onClick={onAiGenerate} className="gap-1.5">
              <span className="text-xs">✦</span> AI Generate
            </Button>
          </CanAccess>
          <CanAccess permission="assessment_pool.create">
            <Button size="sm" onClick={onAddAssessment}>
              Create Assessment
            </Button>
          </CanAccess>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border px-2 py-1 text-xs"
        >
          <option value="">All Types</option>
          {Object.entries(questionTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="rounded-md border px-2 py-1 text-xs"
        >
          <option value="">All Difficulty</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>

      {pools.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-muted-foreground">
          <p className="text-sm">No assessments in pool yet.</p>
          <p className="text-xs mt-1">Create assessments and reuse them across multiple courses.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {pools.map((pool) => (
            <button
              key={pool.id}
              type="button"
              className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              onClick={() => onSelectAssessment(pool.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{pool.title}</span>
                  <span className="text-xs text-muted-foreground font-mono">{pool.code}</span>
                  {pool.isAiGenerated && (
                    <Badge variant="accent" className="text-[10px] px-1.5 py-0">✦ AI</Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="info" className="text-[10px] px-1.5 py-0">
                    {questionTypeLabels[pool.questionType] ?? pool.questionType}
                  </Badge>
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${difficultyColors[pool.difficultyLevel] ?? ""}`}>
                    {pool.difficultyLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pool.questionCount} question{pool.questionCount !== 1 ? "s" : ""} · {pool.totalMarks} marks
                  </span>
                  {pool.courseLinksCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · linked to {pool.courseLinksCount} course{pool.courseLinksCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={statusVariant[pool.status] ?? "info"} className="shrink-0 mt-0.5">
                {pool.status}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
