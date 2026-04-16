import "server-only";

import {
  buildCsvHeaderIndexes,
  buildCsvRowRecord,
  isBlankCsvRow,
  mapCsvImportIssue,
  mapCsvImportZodIssues,
  parseCsvRows,
} from "@/lib/bulk-import/csv";
import { LEARNER_IMPORT_HEADERS, LEARNER_IMPORT_MAX_ROWS } from "@/lib/imports/learners";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { createLearnerSchema, type CommitLearnerImportInput } from "@/lib/validation-schemas/learners";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { createLearnerService } from "@/services/learners/commands";
import type { LearnerImportCommitResult, LearnerImportPreview, LearnerImportRow, LearnerImportRowInput } from "@/services/learners/types";

type PreviewLearnerImportInput = {
  fileName: string;
  csvText: string;
};

type BatchLookupRecord = {
  id: string;
  code: string;
  programName: string;
};

function createEmptyLearnerImportRowInput(): LearnerImportRowInput {
  return {
    fullName: "",
    email: "",
    phone: "",
    programName: "",
    batchCode: "",
    campus: "",
  };
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeBatchCode(value: string) {
  return value.trim().toUpperCase();
}

function buildLearnerPreviewSummary(fileName: string, rows: LearnerImportRow[]): LearnerImportPreview {
  const createCount = rows.filter((row) => row.status === "create").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  return {
    fileName,
    headers: [...LEARNER_IMPORT_HEADERS],
    totalRows: rows.length,
    createCount,
    errorCount,
    actionableCount: createCount,
    hasBlockingErrors: errorCount > 0,
    rows,
  };
}

function buildLearnerPreviewRow(rawRow: LearnerImportRowInput, rowNumber: number): LearnerImportRow {
  const normalizedCandidate = {
    fullName: normalizeText(rawRow.fullName),
    email: normalizeText(rawRow.email).toLowerCase(),
    phone: normalizeText(rawRow.phone),
    programName: normalizeText(rawRow.programName),
    batchCode: normalizeBatchCode(rawRow.batchCode),
    campus: normalizeText(rawRow.campus),
  };

  const parseResult = createLearnerSchema.safeParse(normalizedCandidate);
  const issues = parseResult.success ? [] : mapCsvImportZodIssues(parseResult.error.issues);

  return {
    rowNumber,
    status: issues.length === 0 && parseResult.success ? "create" : "error",
    input: rawRow,
    normalizedEmail: normalizedCandidate.email || null,
    normalizedBatchCode: normalizedCandidate.batchCode || null,
    normalizedData: issues.length === 0 && parseResult.success ? { rowNumber, ...parseResult.data } : null,
    issues,
  };
}

function detectDuplicateLearnerRows(rows: LearnerImportRow[]) {
  const rowNumbersByEmail = new Map<string, number[]>();

  for (const row of rows) {
    if (!row.normalizedEmail || row.issues.length > 0) {
      continue;
    }

    const existing = rowNumbersByEmail.get(row.normalizedEmail) ?? [];
    existing.push(row.rowNumber);
    rowNumbersByEmail.set(row.normalizedEmail, existing);
  }

  return rows.map((row) => {
    if (!row.normalizedEmail || row.issues.length > 0) {
      return row;
    }

    const duplicates = rowNumbersByEmail.get(row.normalizedEmail) ?? [];
    if (duplicates.length <= 1) {
      return row;
    }

    return {
      ...row,
      status: "error" as const,
      normalizedData: null,
      issues: [...row.issues, mapCsvImportIssue("email", `Duplicate email in upload file. Rows: ${duplicates.join(", ")}.`)],
    } satisfies LearnerImportRow;
  });
}

async function loadBatchLookup(batchCodes: string[]) {
  const uniqueBatchCodes = Array.from(new Set(batchCodes.map((batchCode) => batchCode.trim()).filter(Boolean)));

  if (uniqueBatchCodes.length === 0) {
    return new Map<string, BatchLookupRecord>();
  }

  const batches = await prisma.batch.findMany({
    where: {
      OR: uniqueBatchCodes.map((batchCode) => ({
        code: { equals: batchCode, mode: "insensitive" },
      })),
    },
    select: {
      id: true,
      code: true,
      program: {
        select: {
          name: true,
        },
      },
    },
  });

  return new Map(
    batches.map((batch) => [
      batch.code.trim().toUpperCase(),
      {
        id: batch.id,
        code: batch.code,
        programName: batch.program.name,
      },
    ]),
  );
}

async function validateLearnerBatchAssignments(rows: LearnerImportRow[]) {
  const batchLookup = await loadBatchLookup(rows.flatMap((row) => (row.normalizedData?.batchCode ? [row.normalizedData.batchCode] : [])));

  return rows.map((row) => {
    if (!row.normalizedData) {
      return row;
    }

    const batch = batchLookup.get(normalizeBatchCode(row.normalizedData.batchCode));
    if (!batch) {
      return {
        ...row,
        status: "error" as const,
        normalizedData: null,
        issues: [...row.issues, mapCsvImportIssue("batchCode", "Invalid batch code.")],
      } satisfies LearnerImportRow;
    }

    if (batch.programName.trim().toLowerCase() !== row.normalizedData.programName.trim().toLowerCase()) {
      return {
        ...row,
        status: "error" as const,
        normalizedData: null,
        issues: [
          ...row.issues,
          mapCsvImportIssue(
            "programName",
            `Program name does not match batch ${batch.code}. Expected ${batch.programName}.`,
          ),
        ],
      } satisfies LearnerImportRow;
    }

    return row;
  });
}

async function markExistingLearnerConflicts(rows: LearnerImportRow[]) {
  const emails = Array.from(new Set(rows.flatMap((row) => (row.normalizedData?.email ? [row.normalizedData.email] : []))));

  const [existingLearners, existingUsers] = await Promise.all([
    emails.length > 0
      ? prisma.learner.findMany({
          where: {
            OR: emails.map((email) => ({
              email: { equals: email, mode: "insensitive" },
            })),
          },
          select: { email: true },
        })
      : Promise.resolve([] as Array<{ email: string }>),
    emails.length > 0
      ? prisma.user.findMany({
          where: {
            OR: emails.map((email) => ({
              email: { equals: email, mode: "insensitive" },
            })),
          },
          select: { email: true },
        })
      : Promise.resolve([] as Array<{ email: string }>),
  ]);

  const learnerEmailSet = new Set(existingLearners.map((learner) => learner.email.trim().toLowerCase()));
  const userEmailSet = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));

  return rows.map((row) => {
    if (!row.normalizedData) {
      return row;
    }

    const issues = [...row.issues];
    const normalizedEmail = row.normalizedData.email.trim().toLowerCase();

    if (learnerEmailSet.has(normalizedEmail)) {
      issues.push(mapCsvImportIssue("email", "Learner email already exists."));
    } else if (userEmailSet.has(normalizedEmail)) {
      issues.push(mapCsvImportIssue("email", "A user account already exists with this email."));
    }

    if (issues.length === row.issues.length) {
      return row;
    }

    return {
      ...row,
      status: "error" as const,
      normalizedData: null,
      issues,
    } satisfies LearnerImportRow;
  });
}

function ensureUniqueLearnerCommitEmails(rows: CommitLearnerImportInput["rows"]) {
  const rowNumbersByEmail = new Map<string, number[]>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const existing = rowNumbersByEmail.get(email) ?? [];
    existing.push(row.rowNumber);
    rowNumbersByEmail.set(email, existing);
  }

  const duplicateRows = [...rowNumbersByEmail.values()].filter((rowNumbers) => rowNumbers.length > 1);
  if (duplicateRows.length > 0) {
    throw new Error(`Upload contains duplicate email values. Fix rows ${duplicateRows.flat().join(", ")} and preview again.`);
  }
}

async function assertNoExistingLearnerConflicts(rows: CommitLearnerImportInput["rows"]) {
  const emails = Array.from(new Set(rows.map((row) => row.email.trim().toLowerCase())));

  const [existingLearners, existingUsers] = await Promise.all([
    emails.length > 0
      ? prisma.learner.findMany({
          where: {
            OR: emails.map((email) => ({
              email: { equals: email, mode: "insensitive" },
            })),
          },
          select: { email: true },
        })
      : Promise.resolve([] as Array<{ email: string }>),
    emails.length > 0
      ? prisma.user.findMany({
          where: {
            OR: emails.map((email) => ({
              email: { equals: email, mode: "insensitive" },
            })),
          },
          select: { email: true },
        })
      : Promise.resolve([] as Array<{ email: string }>),
  ]);

  const learnerEmailSet = new Set(existingLearners.map((learner) => learner.email.trim().toLowerCase()));
  const userEmailSet = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));

  const learnerConflicts = rows.filter((row) => learnerEmailSet.has(row.email.trim().toLowerCase())).map((row) => row.rowNumber);
  if (learnerConflicts.length > 0) {
    throw new Error(`Learner email already exists for rows ${learnerConflicts.join(", ")}. Preview again before importing.`);
  }

  const userConflicts = rows.filter((row) => userEmailSet.has(row.email.trim().toLowerCase())).map((row) => row.rowNumber);
  if (userConflicts.length > 0) {
    throw new Error(`A user account already exists for rows ${userConflicts.join(", ")}. Preview again before importing.`);
  }
}

async function assertLearnerBatchesStillValid(rows: CommitLearnerImportInput["rows"]) {
  const batchLookup = await loadBatchLookup(rows.map((row) => row.batchCode));

  for (const row of rows) {
    const batch = batchLookup.get(normalizeBatchCode(row.batchCode));
    if (!batch) {
      throw new Error(`Row ${row.rowNumber}: Invalid batch code.`);
    }

    if (batch.programName.trim().toLowerCase() !== row.programName.trim().toLowerCase()) {
      throw new Error(`Row ${row.rowNumber}: Program name does not match batch ${batch.code}. Expected ${batch.programName}.`);
    }
  }
}

export async function previewLearnerImportService(
  input: PreviewLearnerImportInput,
  options?: { actorUserId?: string | null },
): Promise<LearnerImportPreview> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const parsedRows = parseCsvRows(input.csvText);
  const headerRow = parsedRows[0];

  if (!headerRow || headerRow.every((value) => value.trim().length === 0)) {
    throw new Error("CSV must include a header row.");
  }

  const headerIndexes = buildCsvHeaderIndexes(headerRow, LEARNER_IMPORT_HEADERS);
  const rawRows = parsedRows
    .slice(1)
    .map((row) => buildCsvRowRecord(row, headerIndexes, LEARNER_IMPORT_HEADERS))
    .map((row) => ({ ...createEmptyLearnerImportRowInput(), ...row }))
    .filter((row) => !isBlankCsvRow(row));

  if (rawRows.length === 0) {
    throw new Error("CSV must include at least one learner row.");
  }

  if (rawRows.length > LEARNER_IMPORT_MAX_ROWS) {
    throw new Error(`Upload at most ${LEARNER_IMPORT_MAX_ROWS} rows at a time.`);
  }

  const previewRows = rawRows.map((rawRow, index) => buildLearnerPreviewRow(rawRow, index + 2));
  const deduplicatedRows = detectDuplicateLearnerRows(previewRows);
  const rowsWithValidBatches = await validateLearnerBatchAssignments(deduplicatedRows);
  const rowsWithConflicts = await markExistingLearnerConflicts(rowsWithValidBatches);
  const preview = buildLearnerPreviewSummary(input.fileName, rowsWithConflicts);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: input.fileName,
    action: AUDIT_ACTION_TYPE.UPDATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Previewed learner bulk import ${input.fileName}.`,
    metadata: {
      domain: "LEARNER_BULK_IMPORT",
      fileName: input.fileName,
      totalRows: preview.totalRows,
      createCount: preview.createCount,
      errorCount: preview.errorCount,
    },
  });

  return preview;
}

export async function commitLearnerImportService(
  input: CommitLearnerImportInput,
  options?: { actorUserId?: string | null },
): Promise<LearnerImportCommitResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  ensureUniqueLearnerCommitEmails(input.rows);
  await assertNoExistingLearnerConflicts(input.rows);
  await assertLearnerBatchesStillValid(input.rows);

  let createdCount = 0;

  for (const row of input.rows) {
    try {
      await createLearnerService(row);
      createdCount += 1;
    } catch (error) {
      throw new Error(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : "Unable to create learner."}`);
    }
  }

  const result = {
    fileName: input.fileName,
    createdCount,
    totalCount: createdCount,
  } satisfies LearnerImportCommitResult;

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: input.fileName,
    action: AUDIT_ACTION_TYPE.CREATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Imported ${result.totalCount} learner row(s).`,
    metadata: {
      domain: "LEARNER_BULK_IMPORT",
      fileName: input.fileName,
      createdCount: result.createdCount,
      totalCount: result.totalCount,
      rowCount: input.rows.length,
    },
  });

  return result;
}