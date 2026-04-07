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

export type AuthoredContentBlock = z.infer<typeof authoredContentBlockSchema>;
export type AuthoredContentDocument = z.infer<typeof authoredContentDocumentSchema>;

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