import { z } from "zod";

const authoredContentBlockIdSchema = z.string().trim().min(1).max(80);

export const authoredHeadingBlockSchema = z.object({
  id: authoredContentBlockIdSchema,
  type: z.literal("HEADING"),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  text: z.string().trim().min(1).max(500),
});

export const authoredParagraphBlockSchema = z.object({
  id: authoredContentBlockIdSchema,
  type: z.literal("PARAGRAPH"),
  text: z.string().trim().min(1).max(12000),
});

export const authoredImageBlockSchema = z.object({
  id: authoredContentBlockIdSchema,
  type: z.literal("IMAGE"),
  imageUrl: z.string().trim().url().max(2000),
  altText: z.string().trim().min(1).max(200),
  caption: z.string().trim().max(500).optional().default(""),
});

export const authoredBulletListBlockSchema = z.object({
  id: authoredContentBlockIdSchema,
  type: z.literal("BULLET_LIST"),
  items: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
});

export const authoredContentBlockSchema = z.discriminatedUnion("type", [
  authoredHeadingBlockSchema,
  authoredParagraphBlockSchema,
  authoredImageBlockSchema,
  authoredBulletListBlockSchema,
]);

export const authoredContentDocumentSchema = z.object({
  version: z.literal(1).default(1),
  blocks: z.array(authoredContentBlockSchema).min(1).max(200),
});

export const authoredContentDocumentV2Schema = z.object({
  version: z.literal(2),
  html: z.string().min(1).max(500000),
});

export const authoredContentAnyDocumentSchema = z.discriminatedUnion("version", [
  authoredContentDocumentSchema,
  authoredContentDocumentV2Schema,
]);

export type AuthoredContentBlock = z.infer<typeof authoredContentBlockSchema>;
export type AuthoredContentDocument = z.infer<typeof authoredContentDocumentSchema>;
export type AuthoredContentDocumentV2 = z.infer<typeof authoredContentDocumentV2Schema>;
export type AuthoredContentAnyDocument = z.infer<typeof authoredContentAnyDocumentSchema>;

type LmsLessonBlueprint = {
  id: "CONCEPT_TO_PRACTICE" | "SKILL_DRILL" | "PROJECT_STUDIO";
  label: string;
  description: string;
  document: AuthoredContentDocument;
};

const LMS_LESSON_BLUEPRINTS: LmsLessonBlueprint[] = [
  {
    id: "CONCEPT_TO_PRACTICE",
    label: "Concept to Practice",
    description: "Explain a concept, walk through examples, then assign a short application task.",
    document: {
      version: 1,
      blocks: [
        { id: "blueprint-c2p-title", type: "HEADING", level: 2, text: "Learning Outcome" },
        { id: "blueprint-c2p-outcome", type: "PARAGRAPH", text: "By the end of this lesson, learners will be able to..." },
        { id: "blueprint-c2p-concepts", type: "HEADING", level: 3, text: "Core Concepts" },
        { id: "blueprint-c2p-concepts-list", type: "BULLET_LIST", items: ["Concept 1", "Concept 2", "Concept 3"] },
        { id: "blueprint-c2p-example", type: "HEADING", level: 3, text: "Worked Example" },
        { id: "blueprint-c2p-example-body", type: "PARAGRAPH", text: "Show a realistic example and explain each decision clearly." },
        { id: "blueprint-c2p-practice", type: "HEADING", level: 3, text: "Practice Task" },
        { id: "blueprint-c2p-practice-body", type: "PARAGRAPH", text: "Prompt learners to apply the concept independently in 10-15 minutes." },
      ],
    },
  },
  {
    id: "SKILL_DRILL",
    label: "Skill Drill",
    description: "Short, repeatable drill format for behavior and fluency-building sessions.",
    document: {
      version: 1,
      blocks: [
        { id: "blueprint-drill-title", type: "HEADING", level: 2, text: "Skill Focus" },
        { id: "blueprint-drill-intro", type: "PARAGRAPH", text: "Define the skill and expected performance standard." },
        { id: "blueprint-drill-steps", type: "HEADING", level: 3, text: "Drill Steps" },
        { id: "blueprint-drill-steps-list", type: "BULLET_LIST", items: ["Demonstrate", "Guided attempt", "Independent attempt", "Feedback loop"] },
        { id: "blueprint-drill-mistakes", type: "HEADING", level: 3, text: "Common Mistakes" },
        { id: "blueprint-drill-mistakes-list", type: "BULLET_LIST", items: ["Mistake A", "Mistake B", "Mistake C"] },
      ],
    },
  },
  {
    id: "PROJECT_STUDIO",
    label: "Project Studio",
    description: "Project-oriented lesson for portfolio or capstone style sessions.",
    document: {
      version: 1,
      blocks: [
        { id: "blueprint-project-title", type: "HEADING", level: 2, text: "Project Brief" },
        { id: "blueprint-project-brief", type: "PARAGRAPH", text: "Describe the scenario, constraints, and target output." },
        { id: "blueprint-project-deliverables", type: "HEADING", level: 3, text: "Deliverables" },
        { id: "blueprint-project-deliverables-list", type: "BULLET_LIST", items: ["Deliverable 1", "Deliverable 2", "Deliverable 3"] },
        { id: "blueprint-project-rubric", type: "HEADING", level: 3, text: "Evaluation Rubric" },
        { id: "blueprint-project-rubric-list", type: "BULLET_LIST", items: ["Criterion A", "Criterion B", "Criterion C"] },
        { id: "blueprint-project-retro", type: "HEADING", level: 3, text: "Reflection Prompt" },
        { id: "blueprint-project-retro-body", type: "PARAGRAPH", text: "Ask learners to document what worked, what failed, and what they would change." },
      ],
    },
  },
];

export function getLmsLessonBlueprints() {
  return LMS_LESSON_BLUEPRINTS.map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    document: structuredClone(item.document),
  }));
}

export function emptyAuthoredContentDocument(): AuthoredContentDocument {
  return {
    version: 1,
    blocks: [
      {
        id: "intro-paragraph",
        type: "PARAGRAPH",
        text: "Start writing the lesson content here.",
      },
    ],
  };
}

export function parseAuthoredContentDocument(value: unknown): AuthoredContentDocument | null {
  const parsed = authoredContentDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getAuthoredContentPlainText(document: AuthoredContentDocument | null | undefined) {
  if (!document) {
    return "";
  }

  return document.blocks
    .flatMap((block) => {
      switch (block.type) {
        case "HEADING":
          return [block.text];
        case "PARAGRAPH":
          return [block.text];
        case "IMAGE":
          return [block.caption || block.altText];
        case "BULLET_LIST":
          return block.items;
        default:
          return [];
      }
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAuthoredExcerpt(document: AuthoredContentDocument | null | undefined, maxLength = 220) {
  const source = getAuthoredContentPlainText(document);
  if (!source) {
    return "";
  }

  if (source.length <= maxLength) {
    return source;
  }

  return `${source.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function estimateReadingMinutesFromDocument(document: AuthoredContentDocument | null | undefined) {
  const source = getAuthoredContentPlainText(document);
  if (!source) {
    return 1;
  }

  const wordCount = source.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
}

export function renderAuthoredContentToHtml(document: AuthoredContentDocument | null | undefined) {
  if (!document) {
    return "";
  }

  const blocksHtml = document.blocks.map((block) => {
    switch (block.type) {
      case "HEADING":
        return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
      case "PARAGRAPH":
        return `<p>${renderMultilineText(block.text)}</p>`;
      case "IMAGE": {
        const caption = block.caption.trim();
        return [
          "<figure>",
          `<img src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(block.altText)}" />`,
          caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "",
          "</figure>",
        ].join("");
      }
      case "BULLET_LIST":
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      default:
        return "";
    }
  }).join("");

  return `<article class="authored-content">${blocksHtml}</article>`;
}

function renderMultilineText(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

/* ---------- V2 (HTML-based) helpers ---------- */

export function parseAuthoredContentAnyDocument(value: unknown): AuthoredContentAnyDocument | null {
  const parsed = authoredContentAnyDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isV2Document(doc: AuthoredContentAnyDocument): doc is AuthoredContentDocumentV2 {
  return doc.version === 2;
}

export function convertV1ToHtml(document: AuthoredContentDocument): string {
  return renderAuthoredContentToHtml(document);
}

export function convertV1ToV2(document: AuthoredContentDocument): AuthoredContentDocumentV2 {
  return {
    version: 2,
    html: convertV1ToHtml(document),
  };
}

export function getAnyDocumentPlainText(doc: AuthoredContentAnyDocument | null | undefined): string {
  if (!doc) return "";
  if (isV2Document(doc)) {
    return stripHtmlTags(doc.html);
  }
  return getAuthoredContentPlainText(doc);
}

export function extractAnyExcerpt(doc: AuthoredContentAnyDocument | null | undefined, maxLength = 220): string {
  const source = getAnyDocumentPlainText(doc);
  if (!source) return "";
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function estimateAnyReadingMinutes(doc: AuthoredContentAnyDocument | null | undefined): number {
  const source = getAnyDocumentPlainText(doc);
  if (!source) return 1;
  const wordCount = source.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
}

export function renderAnyDocumentToHtml(doc: AuthoredContentAnyDocument | null | undefined): string {
  if (!doc) return "";
  if (isV2Document(doc)) return doc.html;
  return renderAuthoredContentToHtml(doc);
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}