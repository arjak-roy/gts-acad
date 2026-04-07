"use client";

import { ArrowRightLeft, Layers3 } from "lucide-react";

import { BatchContentMappingTab } from "@/components/modules/batch-content/batch-content-mapping-tab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BatchMappingPage() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fbff_56%,_#edf4ff_100%)]">
        <CardContent className="pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Course Builder</p>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white text-primary shadow-sm">
                  <ArrowRightLeft className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Batch Mapping</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Operationalize prepared content and assessments by assigning them to the right delivery batches from a single mapping workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Mapping Intent</p>
              <div className="mt-4 rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Layers3 className="h-4 w-4 text-primary" />
                  Delivery alignment
                </div>
                <p className="mt-2 leading-6">
                  Use this page after the content library and assessment pool are stable so every active batch receives the correct reusable materials.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <CardTitle>Batch Assignment Workspace</CardTitle>
          <CardDescription>
            Review which batches have been operationalized and update their content or assessment coverage in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <BatchContentMappingTab />
        </CardContent>
      </Card>
    </div>
  );
}
