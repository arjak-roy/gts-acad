"use client";

import { Award, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { CertificatePreviewRenderer } from "@/components/modules/certifications/certificate-preview-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CanvasElement } from "@/services/certifications/types";

type CertTemplatePreview = {
  id: string;
  title: string;
  description: string | null;
  orientation: string;
  paperSize: string;
  isDefault: boolean;
  isActive: boolean;
  layoutJson: unknown[];
  backgroundColor: string | null;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  signatory1SignatureUrl: string | null;
  signatory2SignatureUrl: string | null;
};

type CertAutoIssueRule = {
  id: string;
  templateId: string;
  batchName: string;
  batchCode: string;
  programName: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  trigger: string;
  isActive: boolean;
};

const triggerLabels: Record<string, string> = {
  CURRICULUM_COMPLETION: "Curriculum Completion",
  ENROLLMENT_COMPLETION: "Enrollment Completion",
};

export function CurriculumCertificateMilestone({
  templates,
  rules,
  curriculumId,
  curriculumTitle,
}: {
  templates: CertTemplatePreview[];
  rules: CertAutoIssueRule[];
  curriculumId: string | null;
  curriculumTitle: string | null;
}) {
  // Find rules relevant to this curriculum
  const relevantRules = curriculumId
    ? rules.filter((r) => r.curriculumId === curriculumId || r.curriculumId === null)
    : rules;

  // Find the template linked via a curriculum-completion rule
  const completionRule = relevantRules.find(
    (r) => r.trigger === "CURRICULUM_COMPLETION" && r.curriculumId === curriculumId,
  );
  const linkedTemplate = completionRule
    ? templates.find((t) => t.id === completionRule.templateId)
    : null;

  // If no linked template, try to find any active rule for this curriculum
  const anyActiveRule = relevantRules.find((r) => r.isActive);
  const displayTemplate = linkedTemplate ?? (anyActiveRule ? templates.find((t) => t.id === anyActiveRule.templateId) : null);
  const displayRule = completionRule ?? anyActiveRule ?? null;

  return (
    <div className="relative">
      {/* Connector line from last module */}
      <div className="flex items-center justify-center py-2">
        <div className="h-8 w-px border-l-2 border-dashed border-[#d4a853]/40" />
      </div>

      {/* Milestone card */}
      <Card className="overflow-hidden border-[#d4a853]/30 bg-gradient-to-br from-[#fffdf7] to-[#fef9ee] shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-[#d4a853]/20 bg-[#d4a853]/5 px-4 py-2.5">
            <Award className="h-4 w-4 text-[#d4a853]" />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8b7530]">
              Completion Milestone
            </p>
            {displayRule && (
              <Badge
                variant={displayRule.isActive ? "default" : "warning"}
                className="ml-auto text-[10px]"
              >
                {displayRule.isActive ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>

          {displayTemplate ? (
            <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
              {/* Certificate preview thumbnail */}
              <div className="overflow-hidden rounded-xl border border-[#d4a853]/20 bg-white shadow-sm">
                <CertificatePreviewRenderer
                  layoutJson={displayTemplate.layoutJson as CanvasElement[]}
                  orientation={displayTemplate.orientation}
                  paperSize={displayTemplate.paperSize}
                  backgroundColor={displayTemplate.backgroundColor}
                  backgroundImageUrl={displayTemplate.backgroundImageUrl}
                  logoUrl={displayTemplate.logoUrl}
                  signatory1SignatureUrl={displayTemplate.signatory1SignatureUrl}
                  signatory2SignatureUrl={displayTemplate.signatory2SignatureUrl}
                />
              </div>

              {/* Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">{displayTemplate.title}</h4>
                {displayTemplate.description && (
                  <p className="text-xs text-slate-500">{displayTemplate.description}</p>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">
                    <span className="font-medium">Trigger:</span>{" "}
                    {displayRule ? (triggerLabels[displayRule.trigger] ?? displayRule.trigger) : "Not configured"}
                  </p>
                  {curriculumTitle && (
                    <p className="text-xs text-slate-600">
                      <span className="font-medium">Curriculum:</span> {curriculumTitle}
                    </p>
                  )}
                  {displayRule && (
                    <p className="text-xs text-slate-500">
                      Learners who complete this curriculum will automatically receive this certificate.
                    </p>
                  )}
                </div>
                <Link href="/certifications/issuance">
                  <Button size="sm" variant="secondary" className="mt-1 h-7 rounded-lg text-xs">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Configure Auto-Issue
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Award className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No certificate configured</p>
              <p className="max-w-sm text-xs text-slate-400">
                Link a certificate template to this curriculum via auto-issue rules to show a completion milestone here.
              </p>
              <Link href="/certifications/issuance">
                <Button size="sm" variant="secondary" className="mt-1 h-7 rounded-lg text-xs">
                  <ChevronRight className="mr-1 h-3 w-3" />
                  Set Up Auto-Issue Rules
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion label */}
      <div className="flex items-center justify-center py-2">
        <div className="rounded-full border border-[#d4a853]/30 bg-[#d4a853]/10 px-3 py-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7530]">
            Curriculum Complete
          </p>
        </div>
      </div>
    </div>
  );
}
