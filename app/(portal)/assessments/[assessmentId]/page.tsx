"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";

type AssessmentDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes: number | null;
  status: string;
  isAiGenerated: boolean;
  questionCount: number;
  courseLinksCount: number;
  createdByName: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  randomSubsetCount: number | null;
  questions: QuestionItem[];
  sections: SectionItem[];
};

type QuestionItem = {
  id: string;
  questionText: string;
  questionType: string;
  difficultyLevel: string | null;
  marks: number;
  sortOrder: number;
  sectionId: string | null;
};

type SectionItem = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HARD: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

function QuestionRow({
  question,
  index,
  assessmentId,
  onEdit,
  onDelete,
}: {
  question: QuestionItem;
  index: number;
  assessmentId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeLabel = QUESTION_TYPE_LABELS[question.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? question.questionType;
  const truncated = question.questionText.length > 120
    ? question.questionText.slice(0, 120) + "…"
    : question.questionText;

  return (
    <div className="group flex items-start gap-4 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/30">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed text-foreground">{truncated}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="default" className="text-[10px]">{typeLabel}</Badge>
          {question.difficultyLevel && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_COLORS[question.difficultyLevel] ?? ""}`}>
              {question.difficultyLevel}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{question.marks} {question.marks === 1 ? "mark" : "marks"}</span>
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEdit}>Edit</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}

function MetadataCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AssessmentBuilderPage() {
  const params = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ title: "", description: "", totalMarks: 100, passingMarks: 40, timeLimitMinutes: null as number | null });
  const [randomization, setRandomization] = useState({ shuffleQuestions: false, shuffleOptions: false, randomSubsetCount: null as number | null });

  const assessmentId = params.assessmentId;

  const loadDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment-pool/${assessmentId}`);
      if (!res.ok) throw new Error("Failed to load assessment");
      const data = (await res.json()) as AssessmentDetail;
      setDetail(data);
      setMetaForm({
        title: data.title,
        description: data.description ?? "",
        totalMarks: data.totalMarks,
        passingMarks: data.passingMarks,
        timeLimitMinutes: data.timeLimitMinutes,
      });
      setRandomization({
        shuffleQuestions: data.shuffleQuestions,
        shuffleOptions: data.shuffleOptions,
        randomSubsetCount: data.randomSubsetCount,
      });
    } catch {
      toast.error("Failed to load assessment.");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleSaveMeta = async () => {
    try {
      const res = await fetch(`/api/assessment-pool/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: assessmentId, ...metaForm }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Assessment updated.");
      setEditingMeta(false);
      await loadDetail();
    } catch {
      toast.error("Failed to update assessment.");
    }
  };

  const handleSaveRandomization = async () => {
    try {
      const res = await fetch(`/api/assessment-pool/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: assessmentId, ...randomization }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Randomization settings saved.");
      await loadDetail();
    } catch {
      toast.error("Failed to save randomization settings.");
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/assessment-pool/${assessmentId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to publish");
      toast.success("Assessment published.");
      await loadDetail();
    } catch {
      toast.error("Failed to publish assessment.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const res = await fetch(`/api/assessment-pool/${assessmentId}/questions/${questionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Question deleted.");
      await loadDetail();
    } catch {
      toast.error("Failed to delete question.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading assessment…</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Assessment not found</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push("/assessments")}>
            ← Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  const typeLabel = QUESTION_TYPE_LABELS[detail.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? detail.questionType;

  // Group questions by section
  const unsectioned = detail.questions.filter((q) => !q.sectionId);
  const sectionedGroups = detail.sections.map((section) => ({
    section,
    questions: detail.questions.filter((q) => q.sectionId === section.id),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/assessments")}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              ← Assessments
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="font-mono text-xs text-muted-foreground">{detail.code}</span>
          </div>
          {editingMeta ? (
            <div className="space-y-3 pt-2">
              <Input
                value={metaForm.title}
                onChange={(e) => setMetaForm((p) => ({ ...p, title: e.target.value }))}
                className="text-lg font-bold"
                placeholder="Assessment title"
              />
              <textarea
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                value={metaForm.description}
                onChange={(e) => setMetaForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)"
              />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Total Marks</label>
                  <Input type="number" min={1} value={metaForm.totalMarks} onChange={(e) => setMetaForm((p) => ({ ...p, totalMarks: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Passing Marks</label>
                  <Input type="number" min={0} value={metaForm.passingMarks} onChange={(e) => setMetaForm((p) => ({ ...p, passingMarks: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Time Limit (min)</label>
                  <Input type="number" min={1} value={metaForm.timeLimitMinutes ?? ""} onChange={(e) => setMetaForm((p) => ({ ...p, timeLimitMinutes: e.target.value ? Number(e.target.value) : null }))} placeholder="No limit" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveMeta}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingMeta(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">{detail.title}</h1>
              {detail.description && <p className="text-sm text-muted-foreground max-w-xl">{detail.description}</p>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editingMeta && (
            <Button variant="ghost" size="sm" onClick={() => setEditingMeta(true)}>Edit Details</Button>
          )}
          {detail.status === "DRAFT" && (
            <Button size="sm" onClick={handlePublish} disabled={publishing || detail.questionCount < 1}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3">
        <MetadataCard label="Questions" value={detail.questionCount} />
        <MetadataCard label="Total Marks" value={detail.totalMarks} />
        <MetadataCard label="Pass Mark" value={detail.passingMarks} />
        <MetadataCard label="Time Limit" value={detail.timeLimitMinutes ? `${detail.timeLimitMinutes}m` : "∞"} />
        <div className="rounded-lg border bg-background p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="default" className="text-[10px]">{typeLabel}</Badge>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_COLORS[detail.difficultyLevel] ?? ""}`}>
              {detail.difficultyLevel}
            </span>
          </div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[detail.status] ?? ""}`}>
            {detail.status}
          </span>
        </div>
      </div>

      {/* Randomization settings */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-bold mb-3">Randomization Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={randomization.shuffleQuestions}
              onChange={(e) => setRandomization((p) => ({ ...p, shuffleQuestions: e.target.checked }))}
              className="rounded border"
            />
            Shuffle questions
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={randomization.shuffleOptions}
              onChange={(e) => setRandomization((p) => ({ ...p, shuffleOptions: e.target.checked }))}
              className="rounded border"
            />
            Shuffle answer options
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap">Random subset:</label>
            <Input
              type="number"
              min={1}
              placeholder="All"
              className="w-20"
              value={randomization.randomSubsetCount ?? ""}
              onChange={(e) => setRandomization((p) => ({ ...p, randomSubsetCount: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
        </div>
        {(randomization.shuffleQuestions !== detail.shuffleQuestions ||
          randomization.shuffleOptions !== detail.shuffleOptions ||
          randomization.randomSubsetCount !== detail.randomSubsetCount) && (
          <div className="mt-3">
            <Button size="sm" onClick={handleSaveRandomization}>Save Randomization</Button>
          </div>
        )}
      </div>

      {/* Sections + Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Questions ({detail.questionCount})</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/assessments/questions/new?poolId=${assessmentId}&context=assessment`)}
            >
              + Add Question
            </Button>
          </div>
        </div>

        {/* Sectioned questions */}
        {sectionedGroups.map(({ section, questions }) => (
          <div key={section.id} className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
              <div>
                <h4 className="text-sm font-bold">{section.title}</h4>
                {section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
              </div>
              <Badge variant="info" className="text-[10px]">{questions.length} questions</Badge>
            </div>
            <div className="space-y-2 p-3">
              {questions.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  index={i}
                  assessmentId={assessmentId}
                  onEdit={() => router.push(`/assessments/questions/${q.id}?poolId=${assessmentId}&context=assessment`)}
                  onDelete={() => handleDeleteQuestion(q.id)}
                />
              ))}
              {questions.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No questions in this section yet.</p>
              )}
            </div>
          </div>
        ))}

        {/* Unsectioned questions */}
        {unsectioned.length > 0 && (
          <div className="space-y-2">
            {sectionedGroups.length > 0 && (
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Unsectioned</h4>
            )}
            {unsectioned.map((q, i) => (
              <QuestionRow
                key={q.id}
                question={q}
                index={i}
                assessmentId={assessmentId}
                onEdit={() => router.push(`/assessments/questions/${q.id}?poolId=${assessmentId}&context=assessment`)}
                onDelete={() => handleDeleteQuestion(q.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {detail.questionCount === 0 && (
          <div className="rounded-lg border-2 border-dashed py-12 text-center">
            <p className="text-base font-bold text-foreground">No questions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first question to unlock publishing.</p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => router.push(`/assessments/questions/new?poolId=${assessmentId}&context=assessment`)}
            >
              + Add First Question
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
