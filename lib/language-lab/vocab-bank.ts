export const LANGUAGE_LAB_VOCAB_IMPORT_HEADERS = [
  "word",
  "englishMeaning",
  "phonetic",
  "difficulty",
  "source",
  "isActive",
] as const;

export type LanguageLabVocabImportHeader = (typeof LANGUAGE_LAB_VOCAB_IMPORT_HEADERS)[number];

export const LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS = 500;
export const LANGUAGE_LAB_VOCAB_IMPORT_MAX_FILE_SIZE_BYTES = 512 * 1024;
export const LANGUAGE_LAB_VOCAB_IMPORT_TEMPLATE_FILE_NAME = "language-lab-vocab-template.csv";
export const LANGUAGE_LAB_VOCAB_IMPORT_ALLOWED_MIME_TYPES = [
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
] as const;

export function normalizeLanguageLabWord(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "").trim();
}

export function normalizeLanguageLabVocabImportHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

export function isLanguageLabVocabImportFileName(fileName: string) {
  return fileName.trim().toLowerCase().endsWith(".csv");
}

export function isLanguageLabVocabImportMimeTypeAllowed(mimeType: string) {
  return LANGUAGE_LAB_VOCAB_IMPORT_ALLOWED_MIME_TYPES.includes(mimeType.trim().toLowerCase() as (typeof LANGUAGE_LAB_VOCAB_IMPORT_ALLOWED_MIME_TYPES)[number]);
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll("\"", '""')}"`;
  }

  return value;
}

export function buildLanguageLabVocabTemplateCsv() {
  const exampleRow = [
    "Guten Morgen",
    "Good morning",
    "GOO-ten MOR-gen",
    "1",
    "bulk_upload",
    "true",
  ];

  return [
    LANGUAGE_LAB_VOCAB_IMPORT_HEADERS.join(","),
    exampleRow.map((cell) => escapeCsvCell(cell)).join(","),
  ].join("\n");
}