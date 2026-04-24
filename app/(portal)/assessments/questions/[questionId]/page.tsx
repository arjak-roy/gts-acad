"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { QuestionEditorPage } from "@/components/modules/question-editor/question-editor-page";

function EditQuestionContent() {
  const params = useParams<{ questionId: string }>();
  const searchParams = useSearchParams();
  const poolId = searchParams.get("poolId") ?? undefined;
  const ctx = searchParams.get("context") === "question-bank" ? "question-bank" as const : "assessment" as const;

  const backHref = ctx === "question-bank"
    ? "/assessments/question-bank"
    : poolId
      ? `/assessments/${poolId}`
      : "/assessments";

  return (
    <QuestionEditorPage
      questionId={params.questionId}
      poolId={poolId}
      context={ctx}
      backHref={backHref}
      backLabel={ctx === "question-bank" ? "Question Bank" : "Assessment"}
    />
  );
}

export default function EditQuestionPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <EditQuestionContent />
    </Suspense>
  );
}
