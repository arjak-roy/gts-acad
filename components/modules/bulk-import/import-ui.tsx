"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

export async function readImportApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload.data;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

export function BulkImportStatusBadge({ status }: { status: "create" | "error" }) {
  if (status === "create") {
    return <Badge variant="success">Create</Badge>;
  }

  return <Badge variant="danger">Error</Badge>;
}

export function BulkImportMetricCard({
  label,
  value,
  helper,
  badge,
  badgeVariant = "default",
}: {
  label: string;
  value: string;
  helper: string;
  badge: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  return (
    <Card className="border-[#d8e1ef] bg-white">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          </div>
          <Badge variant={badgeVariant}>{badge}</Badge>
        </div>
        <p className="text-sm font-medium text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}