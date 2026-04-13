import "server-only";

import { Prisma } from "@prisma/client";
import type { ZodIssue } from "zod";

import {
  type LanguageLabVocabBankImportCommitResult,
  type LanguageLabVocabBankImportIssue,
  type LanguageLabVocabBankImportNormalizedRow,
  type LanguageLabVocabBankImportPreview,
  type LanguageLabVocabBankImportRow,
  type LanguageLabVocabBankImportRowInput,
} from "@/lib/language-lab/types";
import {
  LANGUAGE_LAB_VOCAB_IMPORT_HEADERS,
  LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS,
  type LanguageLabVocabImportHeader,
  normalizeLanguageLabVocabImportHeader,
  normalizeLanguageLabWord,
} from "@/lib/language-lab/vocab-bank";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  type CommitLanguageLabVocabImportInput,
  type LanguageLabVocabImportRowInput as LanguageLabVocabImportRowSchemaInput,
  languageLabVocabImportRowSchema,
} from "@/lib/validation-schemas/language-lab";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";

type PreviewLanguageLabVocabImportInput = {
  fileName: string;
  csvText: string;
};

type ExistingLanguageLabWordRecord = {
  id: string;
  word: string;
  normalizedWord: string;
};

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function trimOrDefault(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : fallback;
}

function mapIssue(field: string | null, message: string): LanguageLabVocabBankImportIssue {
  return {
    field,
    message,
  };
}

function mapZodIssues(issues: ZodIssue[]): LanguageLabVocabBankImportIssue[] {
  return issues.map((issue) => {
    const pathValue = issue.path[0];
    return mapIssue(typeof pathValue === "string" ? pathValue : null, issue.message);
  });
}

function parseCsvRows(csvText: string) {
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

function createEmptyRowInput(): LanguageLabVocabBankImportRowInput {
  return {
    word: "",
    englishMeaning: "",
    phonetic: "",
    difficulty: "",
    source: "",
    isActive: "",
  };
}

function buildHeaderIndexes(headerRow: string[]) {
  const canonicalLookup = new Map(
    LANGUAGE_LAB_VOCAB_IMPORT_HEADERS.map((header) => [header.toLowerCase(), header]),
  );

  const resolvedHeaders = headerRow.map((cell) => {
    const normalized = normalizeLanguageLabVocabImportHeader(cell).toLowerCase();
    return normalized ? canonicalLookup.get(normalized) ?? normalized : "";
  });

  const duplicateHeaders = resolvedHeaders.filter(
    (header, index) => header && resolvedHeaders.indexOf(header) !== index,
  );

  if (duplicateHeaders.length > 0) {
    throw new Error(`CSV contains duplicate header columns: ${[...new Set(duplicateHeaders)].join(", ")}.`);
  }

  const unexpectedHeaders = resolvedHeaders.filter(
    (header): header is string => Boolean(header) && !LANGUAGE_LAB_VOCAB_IMPORT_HEADERS.includes(header as LanguageLabVocabImportHeader),
  );

  const missingHeaders = LANGUAGE_LAB_VOCAB_IMPORT_HEADERS.filter(
    (header) => !resolvedHeaders.includes(header),
  );

  if (missingHeaders.length > 0 || unexpectedHeaders.length > 0) {
    const parts: string[] = [];

    if (missingHeaders.length > 0) {
      parts.push(`missing ${missingHeaders.join(", ")}`);
    }

    if (unexpectedHeaders.length > 0) {
      parts.push(`unexpected ${unexpectedHeaders.join(", ")}`);
    }

    throw new Error(
      `CSV headers must match ${LANGUAGE_LAB_VOCAB_IMPORT_HEADERS.join(", ")} (${parts.join("; ")}).`,
    );
  }

  const indexes = new Map<LanguageLabVocabImportHeader, number>();
  for (const header of LANGUAGE_LAB_VOCAB_IMPORT_HEADERS) {
    indexes.set(header, resolvedHeaders.indexOf(header));
  }

  return indexes;
}

function buildRawRowInput(row: string[], headerIndexes: Map<LanguageLabVocabImportHeader, number>) {
  const input = createEmptyRowInput();

  for (const header of LANGUAGE_LAB_VOCAB_IMPORT_HEADERS) {
    const cellIndex = headerIndexes.get(header) ?? -1;
    input[header] = cellIndex >= 0 ? (row[cellIndex] ?? "") : "";
  }

  return input;
}

function isBlankRow(input: LanguageLabVocabBankImportRowInput) {
  return Object.values(input).every((value) => value.trim().length === 0);
}

function classifyExistingWords(
  rows: LanguageLabVocabBankImportRow[],
  existingWords: ExistingLanguageLabWordRecord[],
) {
  const existingByNormalizedWord = new Map(
    existingWords.map((word) => [word.normalizedWord, word]),
  );

  return rows.map((row) => {
    if (row.issues.length > 0 || !row.normalizedWord) {
      return {
        ...row,
        status: "error" as const,
      };
    }

    const existingWord = existingByNormalizedWord.get(row.normalizedWord);

    return {
      ...row,
      existingWordId: existingWord?.id ?? null,
      existingWord: existingWord?.word ?? null,
      status: existingWord ? ("update" as const) : ("create" as const),
    };
  });
}

function buildPreviewSummary(fileName: string, rows: LanguageLabVocabBankImportRow[]): LanguageLabVocabBankImportPreview {
  const createCount = rows.filter((row) => row.status === "create").length;
  const updateCount = rows.filter((row) => row.status === "update").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  return {
    fileName,
    headers: [...LANGUAGE_LAB_VOCAB_IMPORT_HEADERS],
    totalRows: rows.length,
    createCount,
    updateCount,
    errorCount,
    actionableCount: createCount + updateCount,
    hasBlockingErrors: errorCount > 0,
    rows,
  };
}

async function loadExistingLanguageLabWords(normalizedWords: string[]) {
  if (normalizedWords.length === 0) {
    return [] as ExistingLanguageLabWordRecord[];
  }

  return prisma.languageLabWord.findMany({
    where: {
      normalizedWord: {
        in: normalizedWords,
      },
    },
    select: {
      id: true,
      word: true,
      normalizedWord: true,
    },
  });
}

function detectDuplicateRows(rows: LanguageLabVocabBankImportRow[]) {
  const rowNumbersByNormalizedWord = new Map<string, number[]>();

  for (const row of rows) {
    if (!row.normalizedWord || row.issues.length > 0) {
      continue;
    }

    const existing = rowNumbersByNormalizedWord.get(row.normalizedWord) ?? [];
    existing.push(row.rowNumber);
    rowNumbersByNormalizedWord.set(row.normalizedWord, existing);
  }

  return rows.map((row) => {
    if (!row.normalizedWord || row.issues.length > 0) {
      return row;
    }

    const duplicates = rowNumbersByNormalizedWord.get(row.normalizedWord) ?? [];
    if (duplicates.length <= 1) {
      return row;
    }

    return {
      ...row,
      issues: [
        ...row.issues,
        mapIssue("word", `Duplicate word in upload file. Rows: ${duplicates.join(", ")}.`),
      ],
      status: "error" as const,
    };
  });
}

function validateImportRows(rows: LanguageLabVocabBankImportNormalizedRow[]) {
  const normalizedRows: Array<LanguageLabVocabBankImportNormalizedRow & { normalizedWord: string }> = [];
  const duplicates = new Map<string, number[]>();

  for (const row of rows) {
    const parsed = languageLabVocabImportRowSchema.parse(row) as LanguageLabVocabImportRowSchemaInput;
    const normalizedWord = normalizeLanguageLabWord(parsed.word);

    if (!normalizedWord) {
      throw new Error(`Row ${parsed.rowNumber} has an invalid word.`);
    }

    const existing = duplicates.get(normalizedWord) ?? [];
    existing.push(parsed.rowNumber);
    duplicates.set(normalizedWord, existing);

    normalizedRows.push({
      ...parsed,
      normalizedWord,
    });
  }

  const duplicateRows = [...duplicates.values()].filter((rowNumbers) => rowNumbers.length > 1);
  if (duplicateRows.length > 0) {
    throw new Error(`Upload contains duplicate words. Fix rows ${duplicateRows.flat().join(", ")} and preview again.`);
  }

  return normalizedRows;
}

export async function previewLanguageLabVocabImportService(
  input: PreviewLanguageLabVocabImportInput,
  options?: { actorUserId?: string | null },
): Promise<LanguageLabVocabBankImportPreview> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const parsedRows = parseCsvRows(input.csvText);
  const headerRow = parsedRows[0];

  if (!headerRow || headerRow.every((value) => value.trim().length === 0)) {
    throw new Error("CSV must include a header row.");
  }

  const headerIndexes = buildHeaderIndexes(headerRow);
  const rawRows = parsedRows
    .slice(1)
    .map((row) => buildRawRowInput(row, headerIndexes))
    .filter((row) => !isBlankRow(row));

  if (rawRows.length === 0) {
    throw new Error("CSV must include at least one vocabulary row.");
  }

  if (rawRows.length > LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS) {
    throw new Error(`Upload at most ${LANGUAGE_LAB_VOCAB_IMPORT_MAX_ROWS} rows at a time.`);
  }

  const previewRows = rawRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const parseResult = languageLabVocabImportRowSchema.safeParse({ rowNumber, ...rawRow });
    const normalizedWord = normalizeLanguageLabWord(rawRow.word);

    if (!parseResult.success) {
      return {
        rowNumber,
        status: "error" as const,
        input: rawRow,
        normalizedWord: normalizedWord || null,
        existingWordId: null,
        existingWord: null,
        normalizedData: null,
        issues: mapZodIssues(parseResult.error.issues),
      } satisfies LanguageLabVocabBankImportRow;
    }

    if (!normalizedWord) {
      return {
        rowNumber,
        status: "error" as const,
        input: rawRow,
        normalizedWord: null,
        existingWordId: null,
        existingWord: null,
        normalizedData: null,
        issues: [mapIssue("word", "Word is invalid after normalization.")],
      } satisfies LanguageLabVocabBankImportRow;
    }

    return {
      rowNumber,
      status: "create" as const,
      input: rawRow,
      normalizedWord,
      existingWordId: null,
      existingWord: null,
      normalizedData: parseResult.data,
      issues: [],
    } satisfies LanguageLabVocabBankImportRow;
  });

  const deduplicatedRows = detectDuplicateRows(previewRows);
  const normalizedWords = deduplicatedRows
    .filter((row) => row.issues.length === 0 && row.normalizedWord)
    .map((row) => row.normalizedWord as string);
  const existingWords = await loadExistingLanguageLabWords([...new Set(normalizedWords)]);
  const preview = buildPreviewSummary(
    input.fileName,
    classifyExistingWords(deduplicatedRows, existingWords),
  );

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: input.fileName,
    action: AUDIT_ACTION_TYPE.UPDATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Previewed vocab bank import ${input.fileName}.`,
    metadata: {
      domain: "LANGUAGE_LAB_VOCAB_BANK",
      fileName: input.fileName,
      totalRows: preview.totalRows,
      createCount: preview.createCount,
      updateCount: preview.updateCount,
      errorCount: preview.errorCount,
    },
  });

  return preview;
}

export async function commitLanguageLabVocabImportService(
  input: CommitLanguageLabVocabImportInput,
  options?: { actorUserId?: string | null },
): Promise<LanguageLabVocabBankImportCommitResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const validatedRows = validateImportRows(input.rows);
  const existingWords = await loadExistingLanguageLabWords(
    validatedRows.map((row) => row.normalizedWord),
  );
  const existingByNormalizedWord = new Map(existingWords.map((row) => [row.normalizedWord, row]));

  let createdCount = 0;
  let updatedCount = 0;

  for (const row of validatedRows) {
    const isExisting = existingByNormalizedWord.has(row.normalizedWord);
    const data = {
      word: row.word.trim(),
      normalizedWord: row.normalizedWord,
      englishMeaning: trimToNull(row.englishMeaning),
      phonetic: trimToNull(row.phonetic),
      difficulty: row.difficulty,
      source: trimOrDefault(row.source, "bulk_upload"),
      isActive: row.isActive,
    };

    try {
      await prisma.languageLabWord.upsert({
        where: { normalizedWord: row.normalizedWord },
        update: data,
        create: data,
        select: { id: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Concurrent write for the same normalizedWord — skip, it's already in the bank
        updatedCount += 1;
        continue;
      }
      throw error;
    }

    if (isExisting) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  const result = {
    fileName: input.fileName,
    createdCount,
    updatedCount,
    totalCount: createdCount + updatedCount,
  } satisfies LanguageLabVocabBankImportCommitResult;

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: input.fileName || "vocab-bank-import",
    action: AUDIT_ACTION_TYPE.UPDATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Imported ${result.totalCount} vocab bank row(s).`,
    metadata: {
      domain: "LANGUAGE_LAB_VOCAB_BANK",
      fileName: input.fileName,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      totalCount: result.totalCount,
      rowCount: validatedRows.length,
    },
  });

  return result;
}