import "server-only";

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type {
  AssessmentSummaryReport,
  LearnerPerformanceRow,
  QuestionAnalyticsRow,
} from "@/services/assessment-analytics/types";

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvString(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── Excel helpers ────────────────────────────────────────────────────────────

async function excelResponse(headers: string[], rows: string[][], filename: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  // Header row
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // Auto-fit columns
  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.value ? String(cell.value).length : 0;
      if (length > maxLength) maxLength = Math.min(length, 50);
    });
    column.width = maxLength + 2;
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── PDF helpers ──────────────────────────────────────────────────────────────

function pdfResponse(title: string, headers: string[], rows: string[][], filename: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 21);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 10, left: 10, right: 10 },
  });

  const pdfBuffer = doc.output("arraybuffer");

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── Summary Report Export ────────────────────────────────────────────────────

const SUMMARY_HEADERS = [
  "Assessment Code",
  "Assessment Title",
  "Question Type",
  "Difficulty",
  "Assigned Learners",
  "Total Attempts",
  "Completed",
  "Pass Rate (%)",
  "Fail Rate (%)",
  "Avg Score (%)",
  "Highest Score (%)",
  "Lowest Score (%)",
  "Pending Review",
];

function summaryToRows(data: AssessmentSummaryReport[]): string[][] {
  return data.map((row) => [
    row.assessmentCode,
    row.assessmentTitle,
    row.questionType,
    row.difficultyLevel ?? "",
    String(row.totalAssignedLearners),
    String(row.totalAttempts),
    String(row.completedAttempts),
    String(row.passRate),
    String(row.failRate),
    String(row.averageScore),
    String(row.highestScore),
    String(row.lowestScore),
    String(row.pendingReviewCount),
  ]);
}

export function exportSummaryReport(
  format: "csv" | "xlsx" | "pdf",
  data: AssessmentSummaryReport[],
) {
  const rows = summaryToRows(data);
  const filename = `assessment-summary-report.${format === "xlsx" ? "xlsx" : format}`;

  switch (format) {
    case "csv":
      return csvResponse(toCsvString(SUMMARY_HEADERS, rows), filename);
    case "xlsx":
      return excelResponse(SUMMARY_HEADERS, rows, filename);
    case "pdf":
      return pdfResponse("Assessment Summary Report", SUMMARY_HEADERS, rows, filename);
  }
}

// ── Learner Performance Export ───────────────────────────────────────────────

const LEARNER_HEADERS = [
  "Learner Code",
  "Learner Name",
  "Assessment",
  "Attempts",
  "Latest Score (%)",
  "Highest Score (%)",
  "Passed",
  "Status",
  "Completion Date",
];

function learnerToRows(data: LearnerPerformanceRow[]): string[][] {
  return data.map((row) => [
    row.learnerCode,
    row.learnerName,
    row.assessmentTitle,
    String(row.attemptCount),
    row.latestScore !== null ? String(row.latestScore) : "-",
    row.highestScore !== null ? String(row.highestScore) : "-",
    row.passed === null ? "N/A" : row.passed ? "Yes" : "No",
    row.status,
    row.completionDate ?? "-",
  ]);
}

export function exportLearnerPerformanceReport(
  format: "csv" | "xlsx" | "pdf",
  data: LearnerPerformanceRow[],
) {
  const rows = learnerToRows(data);
  const filename = `learner-performance-report.${format === "xlsx" ? "xlsx" : format}`;

  switch (format) {
    case "csv":
      return csvResponse(toCsvString(LEARNER_HEADERS, rows), filename);
    case "xlsx":
      return excelResponse(LEARNER_HEADERS, rows, filename);
    case "pdf":
      return pdfResponse("Learner Performance Report", LEARNER_HEADERS, rows, filename);
  }
}

// ── Question Analytics Export ────────────────────────────────────────────────

const QUESTION_HEADERS = [
  "Question",
  "Type",
  "Marks",
  "Times Answered",
  "Correct Rate (%)",
  "Incorrect Rate (%)",
  "Skipped",
  "Avg Marks Earned",
  "Low Success",
];

function questionToRows(data: QuestionAnalyticsRow[]): string[][] {
  return data.map((row) => [
    row.questionText.length > 80 ? row.questionText.slice(0, 77) + "..." : row.questionText,
    row.questionType,
    String(row.marks),
    String(row.timesAnswered),
    String(row.correctRate),
    String(row.incorrectRate),
    String(row.skippedCount),
    String(row.averageMarksEarned),
    row.isLowSuccess ? "Yes" : "No",
  ]);
}

export function exportQuestionAnalyticsReport(
  format: "csv" | "xlsx" | "pdf",
  data: QuestionAnalyticsRow[],
) {
  const rows = questionToRows(data);
  const filename = `question-analytics-report.${format === "xlsx" ? "xlsx" : format}`;

  switch (format) {
    case "csv":
      return csvResponse(toCsvString(QUESTION_HEADERS, rows), filename);
    case "xlsx":
      return excelResponse(QUESTION_HEADERS, rows, filename);
    case "pdf":
      return pdfResponse("Question Analytics Report", QUESTION_HEADERS, rows, filename);
  }
}
