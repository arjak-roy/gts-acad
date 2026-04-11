"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

import { AssessmentReviewWorkspace } from "@/components/modules/assessment-reviews/assessment-review-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AssessmentReviewsPage() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white/95">
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-950">Assessment Review Queue</h1>
                <Badge variant="info" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">Trainer Workflow</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Review assigned quiz attempts, move work into progress, and complete manual grading for essay and reasoning questions.
              </p>
            </div>

            <Button asChild variant="secondary">
              <Link href="/assessments">Back To Assessment Builder</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AssessmentReviewWorkspace />
    </div>
  );
}