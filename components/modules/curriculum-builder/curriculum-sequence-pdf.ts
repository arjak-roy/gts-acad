"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type CurriculumItemReleaseType = "IMMEDIATE" | "ABSOLUTE_DATE" | "BATCH_RELATIVE" | "PREVIOUS_ITEM_COMPLETION" | "PREVIOUS_ITEM_SCORE" | "MANUAL";

type StageItemForPdf = {
  itemType: "CONTENT" | "ASSESSMENT";
  isRequired: boolean;
  referenceTitle: string;
  referenceCode: string | null;
  status: string | null;
  contentType: string | null;
  questionType: string | null;
  difficultyLevel: string | null;
  release?: {
    releaseType: CurriculumItemReleaseType;
    estimatedDurationMinutes: number | null;
  };
};

type CurriculumForPdf = {
  title: string;
  description: string | null;
  status: string;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  modules: Array<{
    title: string;
    description: string | null;
    stages: Array<{
      title: string;
      description: string | null;
      items: StageItemForPdf[];
    }>;
  }>;
};

const releaseTypeLabels: Record<CurriculumItemReleaseType, string> = {
  IMMEDIATE: "Immediate",
  ABSOLUTE_DATE: "On date",
  BATCH_RELATIVE: "After batch start",
  PREVIOUS_ITEM_COMPLETION: "After completion",
  PREVIOUS_ITEM_SCORE: "After score",
  MANUAL: "Manual",
};

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) return "-";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
}

export function downloadCurriculumSequencePdf(curriculum: CurriculumForPdf, courseName?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(curriculum.title, 14, 18);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const subtitle = [
    courseName ? `Course: ${courseName}` : null,
    `Status: ${curriculum.status}`,
    `${curriculum.moduleCount} Modules · ${curriculum.stageCount} Stages · ${curriculum.itemCount} Items`,
  ].filter(Boolean).join("  |  ");
  doc.text(subtitle, 14, 24);

  if (curriculum.description) {
    doc.setFontSize(8);
    const descLines = doc.splitTextToSize(curriculum.description, pageWidth - 28);
    doc.text(descLines, 14, 30);
  }

  doc.setTextColor(0);

  let startY = curriculum.description ? 36 : 30;

  // Build table rows
  const tableBody: Array<Array<string>> = [];

  let itemSequence = 0;
  for (let mi = 0; mi < curriculum.modules.length; mi++) {
    const mod = curriculum.modules[mi];
    // Module header row
    tableBody.push([
      `Module ${mi + 1}: ${mod.title}`,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    for (let si = 0; si < mod.stages.length; si++) {
      const stage = mod.stages[si];
      // Stage header row
      tableBody.push([
        `  Stage ${mi + 1}.${si + 1}: ${stage.title}`,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      for (const item of stage.items) {
        itemSequence++;
        tableBody.push([
          `    ${itemSequence}. ${item.referenceTitle}`,
          item.itemType,
          item.status ?? "-",
          item.isRequired ? "Yes" : "No",
          item.contentType ?? item.questionType ?? "-",
          item.release ? releaseTypeLabels[item.release.releaseType] : "-",
          item.release?.estimatedDurationMinutes ? formatDuration(item.release.estimatedDurationMinutes) : "-",
        ]);
      }
    }
  }

  autoTable(doc, {
    startY,
    head: [["Title", "Type", "Status", "Required", "Content/Question Type", "Release", "Duration"]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 105], fontSize: 7.5, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 40 },
      5: { cellWidth: 35 },
      6: { cellWidth: 25 },
    },
    didParseCell: (data) => {
      // Style module/stage header rows
      if (data.section === "body") {
        const cellText = String(data.cell.raw ?? "");
        if (cellText.startsWith("Module ") && data.column.index === 0) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 244, 248];
        } else if (cellText.startsWith("  Stage ") && data.column.index === 0) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [248, 250, 252];
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · Page ${i} of ${pageCount}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  // Download
  const safeTitle = curriculum.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  doc.save(`${safeTitle}_sequence.pdf`);
}
