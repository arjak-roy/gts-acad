import type { ZodIssue } from "zod";

export const BULK_IMPORT_MAX_ROWS = 500;
export const BULK_IMPORT_MAX_FILE_SIZE_BYTES = 512 * 1024;
export const BULK_IMPORT_ALLOWED_MIME_TYPES = [
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
] as const;

export type CsvImportIssue = {
  field: string | null;
  message: string;
};

export function normalizeCsvImportHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

export function isCsvImportFileName(fileName: string) {
  return fileName.trim().toLowerCase().endsWith(".csv");
}

export function isCsvImportMimeTypeAllowed(mimeType: string) {
  return BULK_IMPORT_ALLOWED_MIME_TYPES.includes(mimeType.trim().toLowerCase() as (typeof BULK_IMPORT_ALLOWED_MIME_TYPES)[number]);
}

export function mapCsvImportIssue(field: string | null, message: string): CsvImportIssue {
  return {
    field,
    message,
  };
}

export function mapCsvImportZodIssues(issues: ZodIssue[]): CsvImportIssue[] {
  return issues.map((issue) => {
    const pathValue = issue.path[0];
    return mapCsvImportIssue(typeof pathValue === "string" ? pathValue : null, issue.message);
  });
}

export function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      const nextCharacter = csvText[index + 1];

      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted value.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function buildCsvHeaderIndexes<THeader extends string>(headerRow: string[], expectedHeaders: readonly THeader[]) {
  const canonicalLookup = new Map(expectedHeaders.map((header) => [header.toLowerCase(), header]));

  const resolvedHeaders = headerRow.map((cell) => {
    const normalized = normalizeCsvImportHeader(cell).toLowerCase();
    return normalized ? canonicalLookup.get(normalized) ?? normalized : "";
  });

  const duplicateHeaders = resolvedHeaders.filter(
    (header, index) => header && resolvedHeaders.indexOf(header) !== index,
  );

  if (duplicateHeaders.length > 0) {
    throw new Error(`CSV contains duplicate header columns: ${[...new Set(duplicateHeaders)].join(", ")}.`);
  }

  const unexpectedHeaders = resolvedHeaders.filter(
    (header): header is string => Boolean(header) && !expectedHeaders.includes(header as THeader),
  );

  const missingHeaders = expectedHeaders.filter((header) => !resolvedHeaders.includes(header));

  if (missingHeaders.length > 0 || unexpectedHeaders.length > 0) {
    const parts: string[] = [];

    if (missingHeaders.length > 0) {
      parts.push(`missing ${missingHeaders.join(", ")}`);
    }

    if (unexpectedHeaders.length > 0) {
      parts.push(`unexpected ${unexpectedHeaders.join(", ")}`);
    }

    throw new Error(`CSV headers must match ${expectedHeaders.join(", ")} (${parts.join("; ")}).`);
  }

  const indexes = new Map<THeader, number>();

  for (const header of expectedHeaders) {
    indexes.set(header, resolvedHeaders.indexOf(header));
  }

  return indexes;
}

export function buildCsvRowRecord<THeader extends string>(
  row: string[],
  headerIndexes: Map<THeader, number>,
  expectedHeaders: readonly THeader[],
) {
  const input = {} as Record<THeader, string>;

  for (const header of expectedHeaders) {
    const cellIndex = headerIndexes.get(header) ?? -1;
    input[header] = cellIndex >= 0 ? (row[cellIndex] ?? "") : "";
  }

  return input;
}

export function isBlankCsvRow(input: Record<string, string>) {
  return Object.values(input).every((value) => value.trim().length === 0);
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll("\"", '""')}"`;
  }

  return value;
}

export function buildTemplateCsv(headers: readonly string[], exampleRows: readonly string[][]) {
  return [
    headers.join(","),
    ...exampleRows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ].join("\n");
}

export function splitMultiValueCsvCell(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[;,|]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}