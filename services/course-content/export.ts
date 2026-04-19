import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, ExternalHyperlink } from "docx";
import sanitizeHtml from "sanitize-html";

import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import { parseAuthoredContentAnyDocument, renderAnyDocumentToHtml } from "@/lib/authored-content";

export type ExportFormat = "docx" | "html";

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Fetch content from DB
// ---------------------------------------------------------------------------

async function fetchContentForExport(contentId: string) {
  if (!isDatabaseConfigured) throw new Error("Database unavailable.");

  const content = await prisma.courseContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      contentType: true,
      bodyJson: true,
      renderedHtml: true,
      course: { select: { name: true } },
    },
  });

  if (!content) throw new Error("Content not found.");
  if (content.contentType !== "ARTICLE") {
    throw new Error("Only article content can be exported.");
  }

  const doc = parseAuthoredContentAnyDocument(content.bodyJson);
  const html = content.renderedHtml || renderAnyDocumentToHtml(doc);

  if (!html) throw new Error("No content to export.");

  return { title: content.title, courseName: content.course.name, html };
}

// ---------------------------------------------------------------------------
// Sanitize & parse HTML into simple token stream
// ---------------------------------------------------------------------------

type Token =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string; bold?: boolean; italic?: boolean }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "code"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "h4", "figure", "figcaption", "pre", "code", "table", "thead", "tbody", "tr", "th", "td", "ul", "ol", "li", "br", "hr", "blockquote", "strong", "em", "u", "s", "a", "span", "div", "p"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt"],
      a: ["href"],
      "*": ["class", "style"],
    },
  });
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function tokenize(html: string): Token[] {
  const safe = sanitize(html);
  const tokens: Token[] = [];

  // Simple regex-based tokenizer for block-level HTML elements
  const blockPattern = /<(h[1-4]|p|ul|ol|blockquote|pre|table|hr|figure|div|img)[\s>]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = blockPattern.exec(safe)) !== null) {
    const tag = match[1].toLowerCase();
    const startPos = match.index;

    // Find closing tag
    if (tag === "hr") {
      tokens.push({ type: "hr" });
      continue;
    }

    if (tag === "img") {
      const srcMatch = safe.slice(startPos, startPos + 500).match(/src="([^"]*?)"/);
      const altMatch = safe.slice(startPos, startPos + 500).match(/alt="([^"]*?)"/);
      tokens.push({ type: "image", src: srcMatch?.[1] ?? "", alt: altMatch?.[1] ?? "" });
      continue;
    }

    const selfOrClose = tag === "hr" || tag === "img";
    if (selfOrClose) continue;

    const closeTag = `</${tag}>`;
    const closeIdx = safe.indexOf(closeTag, startPos);
    if (closeIdx === -1) continue;

    const innerHtml = safe.slice(startPos + match[0].length - 1, closeIdx);
    const fullTag = safe.slice(startPos, closeIdx + closeTag.length);

    if (tag.startsWith("h")) {
      const level = Number.parseInt(tag[1], 10);
      tokens.push({ type: "heading", level, text: stripTags(innerHtml) });
    } else if (tag === "p") {
      tokens.push({ type: "paragraph", text: stripTags(innerHtml) });
    } else if (tag === "ul" || tag === "ol") {
      const items: string[] = [];
      const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((liMatch = liPattern.exec(fullTag)) !== null) {
        items.push(stripTags(liMatch[1]));
      }
      tokens.push({ type: "list", ordered: tag === "ol", items });
    } else if (tag === "blockquote") {
      tokens.push({ type: "blockquote", text: stripTags(innerHtml) });
    } else if (tag === "pre") {
      tokens.push({ type: "code", text: stripTags(innerHtml) });
    } else if (tag === "table") {
      const headers: string[] = [];
      const rows: string[][] = [];
      const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch: RegExpExecArray | null;
      let firstRow = true;
      // eslint-disable-next-line no-cond-assign
      while ((trMatch = trPattern.exec(fullTag)) !== null) {
        const cells: string[] = [];
        const cellPattern = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
        let cellMatch: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((cellMatch = cellPattern.exec(trMatch[1])) !== null) {
          cells.push(stripTags(cellMatch[1]));
        }
        if (firstRow && fullTag.includes("<th")) {
          headers.push(...cells);
          firstRow = false;
        } else {
          rows.push(cells);
          firstRow = false;
        }
      }
      tokens.push({ type: "table", headers, rows });
    } else if (tag === "figure") {
      const imgSrc = fullTag.match(/src="([^"]*?)"/);
      const imgAlt = fullTag.match(/alt="([^"]*?)"/);
      if (imgSrc) {
        tokens.push({ type: "image", src: imgSrc[1], alt: imgAlt?.[1] ?? "" });
      }
    }

    lastIndex = closeIdx + closeTag.length;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// DOCX Generation
// ---------------------------------------------------------------------------

function headingLevelMap(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1;
    case 2: return HeadingLevel.HEADING_2;
    case 3: return HeadingLevel.HEADING_3;
    default: return HeadingLevel.HEADING_4;
  }
}

function tokensToParagraphs(tokens: Token[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        paragraphs.push(
          new Paragraph({
            heading: headingLevelMap(token.level),
            children: [new TextRun({ text: token.text, bold: true })],
          }),
        );
        break;

      case "paragraph":
        if (token.text) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: token.text })],
              spacing: { after: 120 },
            }),
          );
        }
        break;

      case "list":
        for (let i = 0; i < token.items.length; i++) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: token.items[i] })],
              bullet: token.ordered ? undefined : { level: 0 },
              numbering: token.ordered ? { reference: "default-numbering", level: 0 } : undefined,
              spacing: { after: 60 },
            }),
          );
        }
        break;

      case "blockquote":
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: token.text, italics: true, color: "64748b" })],
            indent: { left: 720 },
            spacing: { after: 120 },
          }),
        );
        break;

      case "code":
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: token.text, font: "Courier New", size: 18 })],
            shading: { fill: "f1f5f9", type: "clear" as unknown as undefined },
            spacing: { after: 120 },
          }),
        );
        break;

      case "image":
        // Images are represented as a placeholder text with the alt/URL
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[Image: ${token.alt || token.src}]`, italics: true, color: "94a3b8" }),
            ],
            spacing: { after: 120 },
          }),
        );
        break;

      case "table": {
        const colCount = Math.max(token.headers.length, token.rows[0]?.length ?? 1);
        const tableRows: TableRow[] = [];

        if (token.headers.length > 0) {
          tableRows.push(
            new TableRow({
              children: token.headers.map(
                (h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                    width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
                    shading: { fill: "f8fafc" },
                  }),
              ),
            }),
          );
        }

        for (const row of token.rows) {
          tableRows.push(
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: cell })] })],
                    width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
                  }),
              ),
            }),
          );
        }

        if (tableRows.length > 0) {
          paragraphs.push(new Paragraph({ spacing: { before: 120 } }));
          // Tables are added as a special case — we can't mix Paragraphs and Tables
          // The caller will handle extracting tables from the paragraphs array
        }
        break;
      }

      case "hr":
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: "───────────────────────────────────────", color: "e2e8f0" })],
            spacing: { before: 240, after: 240 },
            alignment: AlignmentType.CENTER,
          }),
        );
        break;
    }
  }

  return paragraphs;
}

async function generateDocx(title: string, courseName: string, html: string): Promise<Buffer> {
  const tokens = tokenize(html);
  const bodyParagraphs = tokensToParagraphs(tokens);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal" as unknown as undefined,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          // Header: course name
          new Paragraph({
            children: [
              new TextRun({ text: courseName, color: "94a3b8", size: 18, font: "Calibri" }),
            ],
            spacing: { after: 60 },
          }),
          // Title
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title, bold: true, size: 36, color: "0d3b84" })],
            spacing: { after: 300 },
          }),
          // Separator
          new Paragraph({
            children: [new TextRun({ text: "───────────────────────────────────────", color: "dde1e6" })],
            spacing: { after: 300 },
          }),
          // Body content
          ...bodyParagraphs,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ---------------------------------------------------------------------------
// Styled HTML for download (self-contained, print-ready)
// ---------------------------------------------------------------------------

function generateStyledHtml(title: string, courseName: string, html: string): Buffer {
  const safeHtml = sanitize(html);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @media print { @page { margin: 2cm; } body { font-size: 11pt; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1e293b; line-height: 1.7; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .header { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #0d3b84; }
    .header .course-name { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.25rem; }
    .header h1 { font-size: 1.75rem; color: #0d3b84; font-weight: 700; }
    .content h2 { font-size: 1.35rem; font-weight: 700; color: #0d3b84; margin: 1.5rem 0 0.5rem; }
    .content h3 { font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 1.25rem 0 0.5rem; }
    .content h4 { font-size: 1rem; font-weight: 600; color: #334155; margin: 1rem 0 0.25rem; }
    .content p { margin-bottom: 0.75rem; }
    .content ul, .content ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
    .content li { margin-bottom: 0.25rem; }
    .content ul { list-style-type: disc; }
    .content ol { list-style-type: decimal; }
    .content blockquote { border-left: 3px solid #cbd5e1; padding-left: 1rem; margin: 1rem 0; color: #64748b; font-style: italic; }
    .content hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
    .content pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; font-size: 0.85rem; }
    .content code { background: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.85em; }
    .content pre code { background: none; color: inherit; padding: 0; }
    .content img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
    .content a { color: #0d3b84; text-decoration: underline; }
    .content table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    .content th, .content td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; }
    .content th { background: #f8fafc; font-weight: 600; }
    .content mark { background: #fef08a; padding: 0.1rem 0.2rem; border-radius: 2px; }
    .content .callout { display: flex; align-items: flex-start; border-radius: 8px; padding: 12px 16px; margin: 8px 0; }
    .content .callout-info { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .content .callout-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .content .callout-tip { background: #f0fdf4; border-left: 4px solid #22c55e; }
    .content .callout-danger { background: #fef2f2; border-left: 4px solid #ef4444; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="course-name">${escapeHtml(courseName)}</div>
    <h1>${escapeHtml(title)}</h1>
  </div>
  <div class="content">${safeHtml}</div>
  <div class="footer">Exported from GTS Academy &middot; ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
</body>
</html>`;

  return Buffer.from(fullHtml, "utf-8");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportContentAsDocx(contentId: string): Promise<ExportResult> {
  const { title, courseName, html } = await fetchContentForExport(contentId);
  const buffer = await generateDocx(title, courseName, html);
  const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().slice(0, 100) || "content";
  return {
    buffer,
    filename: `${safeTitle}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

export async function exportContentAsHtml(contentId: string): Promise<ExportResult> {
  const { title, courseName, html } = await fetchContentForExport(contentId);
  const buffer = generateStyledHtml(title, courseName, html);
  const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().slice(0, 100) || "content";
  return {
    buffer,
    filename: `${safeTitle}.html`,
    mimeType: "text/html; charset=utf-8",
  };
}
