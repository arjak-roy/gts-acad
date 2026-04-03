import { BookOpen, Calendar, GraduationCap, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LearnerActiveEnrollment, BatchStatus } from "@/types";

type LearnerAssignmentsCardProps = {
  enrollments: LearnerActiveEnrollment[];
  title?: string;
  description?: string;
  emptyMessage?: string;
};

function getBatchStatusBadge(status: BatchStatus) {
  if (status === "IN_SESSION") return "success" as const;
  if (status === "PLANNED") return "info" as const;
  if (status === "COMPLETED") return "default" as const;
  if (status === "CANCELLED" || status === "ARCHIVED") return "danger" as const;
  return "warning" as const;
}

function formatDate(iso?: string | null) {
  if (!iso) {
    return "—";
  }

  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function LearnerAssignmentsCard({
  enrollments,
  title = "Assigned Batches & Courses",
  description = "Active course, program, and batch allocations for this learner.",
  emptyMessage = "This learner has not been assigned to an active batch yet.",
}: LearnerAssignmentsCardProps) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assignments</p>
          <p className="mt-2 text-base font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Badge variant={enrollments.length > 0 ? "info" : "default"}>
          {enrollments.length} Active {enrollments.length === 1 ? "Batch" : "Batches"}
        </Badge>
      </div>

      {enrollments.length > 0 ? (
        <div className="mt-4 space-y-3">
          {enrollments.map((enrollment) => (
            <div key={enrollment.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-bold text-slate-900">{enrollment.courseName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="accent">{enrollment.batchCode}</Badge>
                    <Badge variant={getBatchStatusBadge(enrollment.batchStatus)}>{enrollment.batchStatus.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">{enrollment.programName}</p>
                  <p className="text-sm text-slate-500">{enrollment.batchName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Joined {formatDate(enrollment.joinedAt)}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-start gap-2 rounded-2xl bg-white p-3 text-sm text-slate-600">
                  <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-bold text-slate-900">Program</p>
                    <p>{enrollment.programCode}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-2xl bg-white p-3 text-sm text-slate-600">
                  <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-bold text-slate-900">Course</p>
                    <p>{enrollment.courseCode}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-2xl bg-white p-3 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-bold text-slate-900">Campus</p>
                    <p>{enrollment.campus ?? "Not assigned"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-2xl bg-white p-3 text-sm text-slate-600">
                  <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-bold text-slate-900">Schedule</p>
                    <p>
                      {formatDate(enrollment.startDate)}
                      {enrollment.endDate ? ` to ${formatDate(enrollment.endDate)}` : " onward"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white p-3 text-sm text-slate-600">
                <Users className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-bold text-slate-900">Trainers</p>
                  <p>{enrollment.trainerNames.length > 0 ? enrollment.trainerNames.join(", ") : "Trainer not assigned"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{emptyMessage}</div>
      )}
    </div>
  );
}