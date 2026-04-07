"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardList, FileText, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, "default" | "info" | "warning"> = {
  DRAFT: "info",
  PUBLISHED: "default",
  ARCHIVED: "warning",
};

type CurriculumHierarchyViewProps = {
  curriculum: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    moduleCount: number;
    stageCount: number;
    itemCount: number;
    batchCount: number;
    modules: Array<{
      id: string;
      title: string;
      description: string | null;
      stageCount: number;
      itemCount: number;
      stages: Array<{
        id: string;
        title: string;
        description: string | null;
        itemCount: number;
        items: Array<{
          id: string;
          itemType: "CONTENT" | "ASSESSMENT";
          isRequired: boolean;
          referenceCode: string | null;
          referenceTitle: string;
          referenceDescription: string | null;
          courseName: string | null;
          status: string | null;
          contentType: string | null;
          questionType: string | null;
          difficultyLevel: string | null;
          folderName: string | null;
        }>;
      }>;
    }>;
  };
  assignedAt?: string | Date | null;
  assignedByName?: string | null;
  className?: string;
};

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function CurriculumHierarchyView({ curriculum, assignedAt, assignedByName, className }: CurriculumHierarchyViewProps) {
  const [expandedModuleIds, setExpandedModuleIds] = useState<string[]>(() => curriculum.modules.map((moduleRecord) => moduleRecord.id));

  useEffect(() => {
    setExpandedModuleIds(curriculum.modules.map((moduleRecord) => moduleRecord.id));
  }, [curriculum.id, curriculum.modules]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-3xl border border-[#dde1e6] bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fbff_100%)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-950">{curriculum.title}</p>
              <Badge variant={statusVariant[curriculum.status] ?? "info"}>{curriculum.status}</Badge>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{curriculum.description || "No curriculum description provided."}</p>
          </div>

          <div className="grid min-w-[220px] gap-2 rounded-2xl border border-[#e2e8f0] bg-white/80 p-3 text-xs text-slate-500 sm:grid-cols-2">
            <div>
              <p className="font-black uppercase tracking-[0.2em] text-slate-400">Modules</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{curriculum.moduleCount}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-[0.2em] text-slate-400">Stages</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{curriculum.stageCount}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-[0.2em] text-slate-400">Items</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{curriculum.itemCount}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-[0.2em] text-slate-400">Batch Links</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{curriculum.batchCount}</p>
            </div>
          </div>
        </div>

        {assignedAt || assignedByName ? (
          <p className="mt-4 text-xs text-slate-500">
            {assignedAt ? `Assigned ${formatDateTime(assignedAt)}` : "Assigned"}
            {assignedByName ? ` by ${assignedByName}` : ""}
          </p>
        ) : null}
      </div>

      {curriculum.modules.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-sm text-slate-500">
          This curriculum does not have any modules yet.
        </div>
      ) : (
        <div className="space-y-3">
          {curriculum.modules.map((moduleRecord, moduleIndex) => {
            const isExpanded = expandedModuleIds.includes(moduleRecord.id);

            return (
              <Card key={moduleRecord.id} className="overflow-hidden rounded-3xl border-[#dde1e6]">
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 bg-slate-50/80 px-5 py-4 text-left transition-colors hover:bg-slate-100"
                    onClick={() => {
                      setExpandedModuleIds((current) => (
                        current.includes(moduleRecord.id)
                          ? current.filter((item) => item !== moduleRecord.id)
                          : [...current, moduleRecord.id]
                      ));
                    }}
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default">Module {moduleIndex + 1}</Badge>
                        <p className="text-base font-semibold text-slate-900">{moduleRecord.title}</p>
                        <Badge variant="info">{moduleRecord.stageCount} stages</Badge>
                        <Badge variant="info">{moduleRecord.itemCount} items</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{moduleRecord.description || "No module notes provided."}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-400" /> : <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />}
                  </button>

                  {isExpanded ? (
                    <div className="space-y-4 border-t border-[#edf2f7] px-5 py-5">
                      {moduleRecord.stages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">No stages are defined for this module yet.</div>
                      ) : (
                        moduleRecord.stages.map((stage, stageIndex) => (
                          <div key={stage.id} className="rounded-2xl border border-[#e7edf5] bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="info">Stage {moduleIndex + 1}.{stageIndex + 1}</Badge>
                                  <p className="text-sm font-semibold text-slate-900">{stage.title}</p>
                                  <Badge variant="default">{stage.itemCount} items</Badge>
                                </div>
                                <p className="text-sm leading-6 text-slate-600">{stage.description || "No stage description provided."}</p>
                              </div>
                            </div>

                            {stage.items.length === 0 ? (
                              <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-slate-500">No items have been mapped into this stage yet.</div>
                            ) : (
                              <div className="mt-4 space-y-3">
                                {stage.items.map((item, itemIndex) => (
                                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#eef2f7] bg-slate-50/80 p-3">
                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                                      {item.itemType === "CONTENT" ? <FileText className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={item.itemType === "CONTENT" ? "info" : "accent"}>{item.itemType}</Badge>
                                        <p className="text-sm font-semibold text-slate-900">{itemIndex + 1}. {item.referenceTitle}</p>
                                        {item.isRequired ? <Badge variant="default">Required</Badge> : null}
                                        {item.status ? <Badge variant={statusVariant[item.status] ?? "default"}>{item.status}</Badge> : null}
                                      </div>
                                      <p className="text-xs leading-5 text-slate-500">
                                        {[
                                          item.referenceCode,
                                          item.contentType,
                                          item.questionType,
                                          item.difficultyLevel,
                                          item.folderName,
                                          item.courseName,
                                        ].filter(Boolean).join(" · ") || "No additional metadata available."}
                                      </p>
                                      {item.referenceDescription ? <p className="text-sm leading-6 text-slate-600">{item.referenceDescription}</p> : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}