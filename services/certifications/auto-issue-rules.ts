import "server-only";

import type { CertificateAutoIssueTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma-client";

// ── Types ────────────────────────────────────────────────────────────────────

export type AutoIssueRuleSummary = {
  id: string;
  templateId: string;
  templateTitle: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  trigger: CertificateAutoIssueTrigger;
  isActive: boolean;
  createdAt: string;
};

// ── List rules for a template ────────────────────────────────────────────────

export async function listAutoIssueRulesForTemplateService(
  templateId: string,
): Promise<AutoIssueRuleSummary[]> {
  const rules = await prisma.certificateAutoIssueRule.findMany({
    where: { templateId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      templateId: true,
      curriculumId: true,
      trigger: true,
      isActive: true,
      createdAt: true,
      template: { select: { title: true } },
      curriculum: { select: { title: true } },
    },
  });

  return rules.map((r) => ({
    id: r.id,
    templateId: r.templateId,
    templateTitle: r.template.title,
    curriculumId: r.curriculumId,
    curriculumTitle: r.curriculum?.title ?? null,
    trigger: r.trigger,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── List rules for a course (across templates) ──────────────────────────────

export async function listAutoIssueRulesForCourseService(
  courseId: string,
): Promise<AutoIssueRuleSummary[]> {
  const rules = await prisma.certificateAutoIssueRule.findMany({
    where: { template: { courseId }, deletedAt: null },
    orderBy: [{ template: { title: "asc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      templateId: true,
      curriculumId: true,
      trigger: true,
      isActive: true,
      createdAt: true,
      template: { select: { title: true } },
      curriculum: { select: { title: true } },
    },
  });

  return rules.map((r) => ({
    id: r.id,
    templateId: r.templateId,
    templateTitle: r.template.title,
    curriculumId: r.curriculumId,
    curriculumTitle: r.curriculum?.title ?? null,
    trigger: r.trigger,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Upsert a rule ────────────────────────────────────────────────────────────

export async function upsertAutoIssueRuleService(input: {
  templateId: string;
  curriculumId: string | null;
  trigger: CertificateAutoIssueTrigger;
}): Promise<AutoIssueRuleSummary> {
  // Validate all referenced entities exist
  const [template, curriculum] = await Promise.all([
    prisma.certificateTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true, courseId: true, isActive: true },
    }),
    input.curriculumId
      ? prisma.curriculum.findUnique({
          where: { id: input.curriculumId },
          select: { id: true, courseId: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  if (!template) throw new Error(`Template ${input.templateId} not found.`);
  if (input.curriculumId && !curriculum) throw new Error(`Curriculum ${input.curriculumId} not found.`);
  if (curriculum && curriculum.courseId !== template.courseId) throw new Error("Curriculum must belong to the same course.");
  if (curriculum && curriculum.status !== "PUBLISHED") throw new Error(`Curriculum must be published. Current status: ${curriculum.status}.`);

  const rule = await prisma.certificateAutoIssueRule.upsert({
    where: {
      templateId_curriculumId: {
        templateId: input.templateId,
        curriculumId: input.curriculumId ?? "",
      },
    },
    create: {
      templateId: input.templateId,
      curriculumId: input.curriculumId,
      trigger: input.trigger,
      isActive: true,
    },
    update: {
      trigger: input.trigger,
      isActive: true,
    },
    select: {
      id: true,
      templateId: true,
      curriculumId: true,
      trigger: true,
      isActive: true,
      createdAt: true,
      template: { select: { title: true } },
      curriculum: { select: { title: true } },
    },
  });

  return {
    id: rule.id,
    templateId: rule.templateId,
    templateTitle: rule.template.title,
    curriculumId: rule.curriculumId,
    curriculumTitle: rule.curriculum?.title ?? null,
    trigger: rule.trigger,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
  };
}

// ── Toggle active state ──────────────────────────────────────────────────────

export async function toggleAutoIssueRuleService(
  ruleId: string,
  isActive: boolean,
): Promise<void> {
  await prisma.certificateAutoIssueRule.update({
    where: { id: ruleId },
    data: { isActive },
  });
}

// ── Soft-delete a rule (archival) ───────────────────────────────────────────

export async function deleteAutoIssueRuleService(ruleId: string): Promise<void> {
  await prisma.certificateAutoIssueRule.update({
    where: { id: ruleId },
    data: { deletedAt: new Date() },
  });
}

// ── Restore a soft-deleted rule ──────────────────────────────────────────────

export async function restoreAutoIssueRuleService(ruleId: string): Promise<void> {
  await prisma.certificateAutoIssueRule.update({
    where: { id: ruleId },
    data: { deletedAt: null },
  });
}
