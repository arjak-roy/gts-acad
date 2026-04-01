"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMarkAttendance } from "@/hooks/use-mark-attendance";

const bulkAttendanceFormSchema = z.object({
  batchCode: z.string().trim().min(2, "Batch code is required."),
  sessionDate: z.string().min(1, "Session date is required."),
  rows: z.string().min(3, "At least one row is required."),
});

type BulkAttendanceFormValues = z.infer<typeof bulkAttendanceFormSchema>;

export function AttendanceBulkForm() {
  const mutation = useMarkAttendance();
  const form = useForm<BulkAttendanceFormValues>({
    resolver: zodResolver(bulkAttendanceFormSchema),
    defaultValues: {
      batchCode: "B-GER-NOV",
      sessionDate: new Date().toISOString().slice(0, 10),
      rows: "GTS-240901,PRESENT\nGTS-240902,LATE",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const records = values.rows
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [learnerId, status, ...rest] = line.split(",").map((part) => part.trim());
        return {
          learnerId,
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
          notes: rest.join(",") || undefined,
        };
      });

    await mutation.mutateAsync({
      batchCode: values.batchCode,
      sessionDate: new Date(values.sessionDate),
      records,
    });
    form.reset({ ...values, rows: values.rows });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Bulk Attendance Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Batch Code</label>
              <Input {...form.register("batchCode")} />
              <p className="mt-1 text-xs text-rose-500">{form.formState.errors.batchCode?.message}</p>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Session Date</label>
              <Input type="date" {...form.register("sessionDate")} />
              <p className="mt-1 text-xs text-rose-500">{form.formState.errors.sessionDate?.message}</p>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Rows</label>
            <textarea
              {...form.register("rows")}
              className="min-h-28 w-full rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none ring-0 focus:border-[#0d3b84]"
            />
            <p className="mt-2 text-xs text-slate-500">Format: learnerCode,status,note. One row per line.</p>
            <p className="mt-1 text-xs text-rose-500">{form.formState.errors.rows?.message}</p>
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting..." : "Mark Attendance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}