"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Trash2, Pencil, Check, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ─── Types ──────────────────────────────────────────────────────────────────

type AiGeneratedQuestion = {
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
  marks: number;
};

type AiStep = "PROMPT" | "GENERATING" | "PREVIEW" | "CREATING";

const QUESTION_TYPES = [
  { value: "MCQ", label: "Multiple Choice" },
  { value: "NUMERIC", label: "Numeric" },
  { value: "ESSAY", label: "Essay" },
  { value: "FILL_IN_THE_BLANK", label: "Fill in Blank" },
  { value: "MULTI_INPUT_REASONING", label: "Multi-Input" },
  { value: "TWO_PART_ANALYSIS", label: "Two-Part" },
];

const DIFFICULTY_LEVELS = [
  { value: "EASY", label: "Easy", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "MEDIUM", label: "Medium", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "HARD", label: "Hard", color: "text-rose-600 bg-rose-50 border-rose-200" },
];

const questionTypeLabels: Record<string, string> = {
  MCQ: "MCQ",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in Blank",
  MULTI_INPUT_REASONING: "Multi-Input",
  TWO_PART_ANALYSIS: "Two-Part",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function summarizeAnswer(question: AiGeneratedQuestion): string {
  if (question.questionType === "MCQ") {
    return `Correct: ${String(question.correctAnswer ?? "—")}`;
  }
  if (question.questionType === "NUMERIC") {
    const answer = question.correctAnswer as { value?: number; tolerance?: number } | null;
    if (answer) return `Answer: ${answer.value}${answer.tolerance ? ` ±${answer.tolerance}` : ""}`;
    return "—";
  }
  if (question.questionType === "FILL_IN_THE_BLANK") {
    const answers = question.correctAnswer as string[] | null;
    return answers?.length ? `Accepted: ${answers.join(", ")}` : "—";
  }
  if (question.questionType === "ESSAY") return "Manual grading";
  if (question.questionType === "TWO_PART_ANALYSIS") {
    const answer = question.correctAnswer as { partA?: string; partB?: string } | null;
    return answer ? `A: ${answer.partA}, B: ${answer.partB}` : "—";
  }
  if (question.questionType === "MULTI_INPUT_REASONING") {
    const answer = question.correctAnswer as Record<string, string> | null;
    if (answer) {
      const entries = Object.entries(answer).slice(0, 2);
      return entries.map(([key, value]) => `${key}: ${value}`).join("; ") + (Object.keys(answer).length > 2 ? "…" : "");
    }
    return "—";
  }
  return "—";
}

// ─── Inline Question Editor ─────────────────────────────────────────────────

function InlineQuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: AiGeneratedQuestion;
  onSave: (updated: AiGeneratedQuestion) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question.questionText);
  const [explanation, setExplanation] = useState(question.explanation);
  const [marks, setMarks] = useState(question.marks);

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">Question Text</label>
        <textarea
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Explanation</label>
          <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why this answer is correct" className="text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Marks</label>
          <Input type="number" min={1} value={marks} onChange={(e) => setMarks(Number(e.target.value) || 1)} className="text-sm" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" onClick={() => onSave({ ...question, questionText: text, explanation, marks })} disabled={text.trim().length < 5}>
          <Check className="mr-1 h-3 w-3" /> Save
        </Button>
      </div>
    </div>
  );
}

// ─── Question Card ──────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  isNew,
  isEditing,
  readOnly,
  onEdit,
  onRemove,
  onUpdate,
  onCancelEdit,
}: {
  question: AiGeneratedQuestion;
  index: number;
  isNew: boolean;
  isEditing: boolean;
  readOnly?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (q: AiGeneratedQuestion) => void;
  onCancelEdit: () => void;
}) {
  if (isEditing) {
    return <InlineQuestionEditor question={question} onSave={onUpdate} onCancel={onCancelEdit} />;
  }

  return (
    <div
      className={`group relative rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md ${
        isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-400" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-600">
              {index + 1}
            </span>
            <Badge variant="info" className="text-[10px] px-1.5 py-0">
              {questionTypeLabels[question.questionType] ?? question.questionType}
            </Badge>
            <span className="text-xs text-slate-400">{question.marks} mark{question.marks !== 1 ? "s" : ""}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{question.questionText}</p>
          <p className="mt-1 text-xs text-slate-500">{summarizeAnswer(question)}</p>
          {question.explanation && <p className="mt-1 text-xs text-slate-400 italic">💡 {question.explanation}</p>}
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dialog ────────────────────────────────────────────────────────────

export function AiGenerateDialog({
  open,
  onOpenChange,
  courseId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  onCreated: (poolId: string) => void;
}) {
  const [step, setStep] = useState<AiStep>("PROMPT");
  const [prompt, setPrompt] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["MCQ"]);
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [questionCount, setQuestionCount] = useState(5);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<AiGeneratedQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ prompt: number; completion: number } | null>(null);
  const [streamModel, setStreamModel] = useState<string>("");
  const [lastAddedIndex, setLastAddedIndex] = useState<number>(-1);
  const abortRef = useRef<AbortController | null>(null);
  const wasOpenRef = useRef(false);
  const streamContainerRef = useRef<HTMLDivElement | null>(null);

  const isMixed = selectedTypes.length > 1;
  const totalMarks = useMemo(() => questions.reduce((sum, q) => sum + q.marks, 0), [questions]);

  const resetWorkflow = useCallback(() => {
    setStep("PROMPT");
    setPrompt("");
    setSelectedTypes(["MCQ"]);
    setDifficulty("MEDIUM");
    setQuestionCount(5);
    setTitle("");
    setQuestions([]);
    setEditingIndex(null);
    setTokenUsage(null);
    setStreamModel("");
    setLastAddedIndex(-1);
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) resetWorkflow();
    wasOpenRef.current = open;
  }, [open, resetWorkflow]);

  useEffect(() => {
    if (step === "GENERATING" && streamContainerRef.current) {
      streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
    }
  }, [questions.length, step]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && step === "GENERATING") abortRef.current?.abort();
    if (!nextOpen) resetWorkflow();
    onOpenChange(nextOpen);
  };

  const toggleType = (typeValue: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeValue)) {
        return prev.length > 1 ? prev.filter((t) => t !== typeValue) : prev;
      }
      return [...prev, typeValue];
    });
  };

  const selectAllTypes = () => {
    setSelectedTypes(QUESTION_TYPES.map((t) => t.value));
  };

  // ── Streaming generation ──

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 10) {
      toast.error("Prompt must be at least 10 characters.");
      return;
    }

    setStep("GENERATING");
    setQuestions([]);
    setTokenUsage(null);
    setStreamModel("");
    setLastAddedIndex(-1);
    abortRef.current = new AbortController();

    try {
      const primaryType = selectedTypes[0] ?? "MCQ";

      const response = await fetch("/api/assessment-pool/ai-generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          prompt: prompt.trim(),
          questionType: primaryType,
          questionTypes: selectedTypes.length > 1 ? selectedTypes : undefined,
          questionCount,
          difficultyLevel: difficulty,
          courseId: courseId || undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorBody.error || "Failed to start generation.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available.");

      const decoder = new TextDecoder();
      let buffer = "";
      let questionIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as
              | { type: "question"; data: AiGeneratedQuestion }
              | { type: "done"; model: string; promptTokens: number; completionTokens: number }
              | { type: "error"; message: string };

            if (event.type === "question") {
              const idx = questionIndex++;
              setQuestions((prev) => [...prev, event.data]);
              setLastAddedIndex(idx);
            } else if (event.type === "done") {
              setTokenUsage({ prompt: event.promptTokens, completion: event.completionTokens });
              setStreamModel(event.model);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      setQuestions((current) => {
        if (current.length === 0) {
          toast.error("No questions were generated. Try a more specific prompt.");
          setStep("PROMPT");
          return current;
        }
        setTitle(`AI: ${prompt.trim().slice(0, 80)}`);
        setStep("PREVIEW");
        return current;
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setQuestions((current) => {
          if (current.length > 0) {
            setTitle(`AI: ${prompt.trim().slice(0, 80)}`);
            setStep("PREVIEW");
            toast.info(`Stopped. ${current.length} question${current.length !== 1 ? "s" : ""} were already generated.`);
          } else {
            setStep("PROMPT");
          }
          return current;
        });
        return;
      }
      toast.error(error instanceof Error ? error.message : "Failed to generate questions.");
      setQuestions((current) => {
        if (current.length > 0) {
          setTitle(`AI: ${prompt.trim().slice(0, 80)}`);
          setStep("PREVIEW");
        } else {
          setStep("PROMPT");
        }
        return current;
      });
    }
  };

  // ── Create assessment ──

  const handleCreateAssessment = async () => {
    if (questions.length === 0 || title.trim().length < 2) return;

    setStep("CREATING");
    try {
      const primaryType = selectedTypes[0] ?? "MCQ";
      const response = await fetch("/api/assessment-pool/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          title: title.trim(),
          prompt: prompt.trim(),
          questionType: primaryType,
          difficultyLevel: difficulty,
          totalMarks,
          passingMarks: Math.round(totalMarks * 0.4),
          courseId: courseId || undefined,
          questions,
        }),
      });

      const payload = (await response.json()) as { data?: { poolId: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to create assessment.");
      const createdPoolId = payload.data?.poolId;
      if (!createdPoolId) throw new Error("Assessment created but ID not returned.");

      toast.success(`Assessment created with ${questions.length} question${questions.length !== 1 ? "s" : ""}.`);
      resetWorkflow();
      onOpenChange(false);
      onCreated(createdPoolId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create assessment.");
      setStep("PREVIEW");
    }
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  const handleUpdateQuestion = (index: number, updated: AiGeneratedQuestion) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)));
    setEditingIndex(null);
  };

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of questions) {
      counts[q.questionType] = (counts[q.questionType] ?? 0) + 1;
    }
    return counts;
  }, [questions]);

  // ── Render ──

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,64rem)] max-w-5xl flex-col overflow-hidden p-0">
        {/* Gradient header */}
        <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">AI Assessment Generator</DialogTitle>
              <DialogDescription className="text-indigo-100">
                {step === "PROMPT" && "Describe what you need and let AI create structured, editable questions."}
                {step === "GENERATING" && `Streaming — ${questions.length} of ~${questionCount} questions generated...`}
                {step === "PREVIEW" && `${questions.length} question${questions.length !== 1 ? "s" : ""} generated. Review, edit, then create.`}
                {step === "CREATING" && "Creating your assessment..."}
              </DialogDescription>
            </div>
          </div>

          {/* Step indicator pills */}
          <div className="relative mt-4 flex items-center gap-2">
            {(["PROMPT", "GENERATING", "PREVIEW", "CREATING"] as AiStep[]).map((s, i) => {
              const labels = ["Prompt", "Generate", "Preview", "Create"];
              const stepIndex = ["PROMPT", "GENERATING", "PREVIEW", "CREATING"].indexOf(step);
              const isActive = s === step;
              const isComplete = i < stepIndex;

              return (
                <div
                  key={s}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    isActive ? "bg-white/25 text-white" : isComplete ? "bg-white/10 text-indigo-200" : "text-indigo-300/60"
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                      isActive ? "bg-white text-indigo-700" : isComplete ? "bg-indigo-200/30 text-indigo-100" : "bg-white/10 text-indigo-400/50"
                    }`}
                  >
                    {isComplete ? "✓" : i + 1}
                  </span>
                  {labels[i]}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* ── Step 1: Prompt form ── */}
          {step === "PROMPT" && (
            <form onSubmit={handleGenerate} className="space-y-5 p-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Describe the questions you need</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[120px] resize-y shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:shadow-md"
                  placeholder="e.g., Generate questions about German B1 grammar covering accusative and dative cases, reflexive verbs, and subordinate clauses."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Minimum 10 characters. Be specific about the topic and scope.</span>
                  <span>{prompt.length}/2000</span>
                </div>
              </div>

              {/* Question type multi-select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Question Types
                    <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">
                      ({selectedTypes.length} selected{isMixed ? " — mixed" : ""})
                    </span>
                  </label>
                  <button type="button" onClick={selectAllTypes} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700">
                    Select All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUESTION_TYPES.map((type) => {
                    const isSelected = selectedTypes.includes(type.value);
                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50"
                        }`}
                        onClick={() => toggleType(type.value)}
                      >
                        {isSelected && <Check className="mr-1 inline h-3 w-3" />}
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Difficulty</label>
                  <div className="flex gap-2">
                    {DIFFICULTY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          difficulty === level.value
                            ? level.color + " shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                        onClick={() => setDifficulty(level.value)}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Questions: <span className="text-indigo-600 text-sm font-bold">{questionCount}</span>
                    {isMixed && (
                      <span className="ml-1 text-[10px] font-normal normal-case text-slate-400">
                        (~{Math.max(1, Math.round(questionCount / selectedTypes.length))} per type)
                      </span>
                    )}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>
              </div>

              {courseId && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5">
                  <p className="text-xs text-indigo-600">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    Questions will be scoped to the currently selected course filter.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={prompt.trim().length < 10}
                  className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:from-indigo-700 hover:to-purple-700"
                >
                  <Zap className="h-4 w-4" />
                  Generate {questionCount} Question{questionCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 2: Streaming generation ── */}
          {step === "GENERATING" && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Progress bar */}
              <div className="border-b border-slate-100 px-6 py-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span className="font-medium">
                      Building questions — {questions.length} of ~{questionCount}
                    </span>
                  </div>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => abortRef.current?.abort()}>
                    Stop
                  </Button>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, (questions.length / questionCount) * 100)}%` }}
                  />
                </div>
                {Object.keys(typeCounts).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(typeCounts).map(([type, count]) => (
                      <Badge key={type} variant="info" className="text-[9px] px-1.5 py-0">
                        {questionTypeLabels[type] ?? type} × {count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Streamed question cards */}
              <div ref={streamContainerRef} className="flex-1 space-y-3 overflow-y-auto p-6">
                {questions.map((question, index) => (
                  <QuestionCard
                    key={index}
                    question={question}
                    index={index}
                    isNew={index === lastAddedIndex}
                    isEditing={false}
                    readOnly
                    onEdit={() => {}}
                    onRemove={() => {}}
                    onUpdate={() => {}}
                    onCancelEdit={() => {}}
                  />
                ))}

                {questions.length < questionCount && (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    </div>
                    <span className="text-xs text-slate-400">Generating question {questions.length + 1}...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === "PREVIEW" && (
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Assessment Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., German B1 Grammar Test" className="text-sm" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info" className="gap-1 px-2.5 py-1 text-[10px]">
                  <Sparkles className="h-3 w-3" /> {questions.length} Questions
                </Badge>
                <Badge variant="info" className="px-2.5 py-1 text-[10px]">{totalMarks} Total Marks</Badge>
                {Object.entries(typeCounts).map(([type, count]) => (
                  <Badge key={type} variant="info" className="px-2.5 py-1 text-[10px]">{questionTypeLabels[type] ?? type} × {count}</Badge>
                ))}
                <Badge className={`px-2.5 py-1 text-[10px] ${DIFFICULTY_LEVELS.find((d) => d.value === difficulty)?.color ?? ""}`}>{difficulty}</Badge>
                {streamModel && <Badge variant="default" className="px-2.5 py-1 text-[10px]">{streamModel}</Badge>}
                {tokenUsage && (tokenUsage.prompt + tokenUsage.completion > 0) && (
                  <Badge variant="default" className="px-2.5 py-1 text-[10px]">Tokens: {tokenUsage.prompt + tokenUsage.completion}</Badge>
                )}
              </div>

              <div className="space-y-3">
                {questions.map((question, index) => (
                  <QuestionCard
                    key={index}
                    question={question}
                    index={index}
                    isNew={false}
                    isEditing={editingIndex === index}
                    onEdit={() => setEditingIndex(index)}
                    onRemove={() => handleRemoveQuestion(index)}
                    onUpdate={(q) => handleUpdateQuestion(index, q)}
                    onCancelEdit={() => setEditingIndex(null)}
                  />
                ))}
              </div>

              {questions.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
                  All questions have been removed. Go back to generate new ones.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => { setQuestions([]); setStep("PROMPT"); }}>
                  ← Back to Prompt
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
                  <Button
                    type="button"
                    disabled={questions.length === 0 || title.trim().length < 2}
                    onClick={() => void handleCreateAssessment()}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:from-indigo-700 hover:to-purple-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    Create Assessment ({questions.length})
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Creating ── */}
          {step === "CREATING" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-800">Creating assessment...</p>
                <p className="mt-1 text-sm text-slate-500">
                  Saving &quot;{title}&quot; with {questions.length} question{questions.length !== 1 ? "s" : ""}.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
