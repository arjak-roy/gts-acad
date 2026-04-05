import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import { getBatchEnrollmentExportService } from "@/services/batches-service";

const EXPORT_COLUMNS: Array<keyof ReturnType<typeof buildExportHeaderMap>> = [
  "learnerCode",
  "learnerName",
  "learnerEmail",
  "learnerPhone",
  "learnerCountry",
  "placementStatus",
  "recruiterSyncStatus",
  "readinessPercentage",
  "attendancePercentage",
  "averageScore",
  "courseCode",
  "courseName",
  "programCode",
  "programName",
  "programType",
  "batchCode",
  "batchName",
  "batchStatus",
  "batchMode",
  "campus",
  "enrollmentStatus",
  "joinedAt",
  "completedAt",
  "trainerNames",
];

function buildExportHeaderMap() {
  return {
    learnerCode: "Learner Code",
    learnerName: "Learner Name",
    learnerEmail: "Learner Email",
    learnerPhone: "Learner Phone",
    learnerCountry: "Learner Country",
    placementStatus: "Placement Status",
    recruiterSyncStatus: "Recruiter Sync Status",
    readinessPercentage: "Readiness Percentage",
    attendancePercentage: "Attendance Percentage",
    averageScore: "Average Score",
    courseCode: "Course Code",
    courseName: "Course Name",
    programCode: "Program Code",
    programName: "Program Name",
    programType: "Program Type",
    batchCode: "Batch Code",
    batchName: "Batch Name",
    batchStatus: "Batch Status",
    batchMode: "Batch Mode",
    campus: "Campus",
    enrollmentStatus: "Enrollment Status",
    joinedAt: "Joined At",
    completedAt: "Completed At",
    trainerNames: "Trainer Names",
  };
}

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }

  return value;
}

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.view");
    const { batchId } = batchIdSchema.parse(params);
    const { batchCode, rows } = await getBatchEnrollmentExportService(batchId);
    const headerMap = buildExportHeaderMap();

    const headerLine = EXPORT_COLUMNS.map((column) => escapeCsvCell(headerMap[column])).join(",");
    const valueLines = rows.map((row) => EXPORT_COLUMNS.map((column) => escapeCsvCell(row[column] ?? "")).join(","));
    const csv = [headerLine, ...valueLines].join("\n");

    const fileSafeBatchCode = batchCode.replace(/[^A-Za-z0-9_-]+/g, "-");
    const filename = `batch-${fileSafeBatchCode}-enrollments.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
