import "server-only";

import {
  buildCsvHeaderIndexes,
  buildCsvRowRecord,
  isBlankCsvRow,
  mapCsvImportIssue,
  mapCsvImportZodIssues,
  parseCsvRows,
  splitMultiValueCsvCell,
} from "@/lib/bulk-import/csv";
import { TRAINER_IMPORT_HEADERS, TRAINER_IMPORT_MAX_ROWS } from "@/lib/imports/trainers";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { createTrainerSchema, type CommitTrainerImportInput } from "@/lib/validation-schemas/trainers";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { createTrainerService } from "@/services/trainers/commands";
import {
  loadTrainerCourseLookup,
  normalizeTrainerCourseList,
  normalizeTrainerEmployeeCode,
  resolveTrainerCoursesFromLookup,
} from "@/services/trainers/import-helpers";
import type { TrainerImportCommitResult, TrainerImportPreview, TrainerImportRow, TrainerImportRowInput } from "@/services/trainers/types";

type PreviewTrainerImportInput = {
  fileName: string;
  csvText: string;
};

function createEmptyTrainerImportRowInput(): TrainerImportRowInput {
  return {
    fullName: "",
    employeeCode: "",
    email: "",
    phone: "",
    specialization: "",
    capacity: "",
    status: "",
    availabilityStatus: "",
    courses: "",
    bio: "",
  };
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function parseCapacity(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return { value: 0, issue: null };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return {
      value: 0,
      issue: mapCsvImportIssue("capacity", "Capacity must be an integer between 0 and 100."),
    };
  }

  return { value: parsed, issue: null };
}

function parseTrainerStatus(value: string) {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return { value: "ACTIVE" as const, issue: null };
  }

  if (normalized === "ACTIVE" || normalized === "INACTIVE") {
    return { value: normalized, issue: null };
  }

  return {
    value: "ACTIVE" as const,
    issue: mapCsvImportIssue("status", "Status must be ACTIVE or INACTIVE."),
  };
}

function parseTrainerAvailability(value: string) {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return { value: "AVAILABLE" as const, issue: null };
  }

  if (["AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"].includes(normalized)) {
    return {
      value: normalized as "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "ON_LEAVE",
      issue: null,
    };
  }

  return {
    value: "AVAILABLE" as const,
    issue: mapCsvImportIssue("availabilityStatus", "Availability status must be AVAILABLE, LIMITED, UNAVAILABLE, or ON_LEAVE."),
  };
}

function buildTrainerPreviewSummary(fileName: string, rows: TrainerImportRow[]): TrainerImportPreview {
  const createCount = rows.filter((row) => row.status === "create").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  return {
    fileName,
    headers: [...TRAINER_IMPORT_HEADERS],
    totalRows: rows.length,
    createCount,
    errorCount,
    actionableCount: createCount,
    hasBlockingErrors: errorCount > 0,
    rows,
  };
}

function buildTrainerPreviewRow(rawRow: TrainerImportRowInput, rowNumber: number): TrainerImportRow {
  const issues = [] as TrainerImportRow["issues"];
  const capacity = parseCapacity(rawRow.capacity);
  const status = parseTrainerStatus(rawRow.status);
  const availability = parseTrainerAvailability(rawRow.availabilityStatus);
  const courses = normalizeTrainerCourseList(splitMultiValueCsvCell(rawRow.courses));

  if (capacity.issue) {
    issues.push(capacity.issue);
  }

  if (status.issue) {
    issues.push(status.issue);
  }

  if (availability.issue) {
    issues.push(availability.issue);
  }

  if (courses.length === 0) {
    issues.push(mapCsvImportIssue("courses", "At least one course is required."));
  }

  const normalizedCandidate = {
    fullName: normalizeText(rawRow.fullName),
    employeeCode: normalizeTrainerEmployeeCode(rawRow.employeeCode),
    email: normalizeText(rawRow.email).toLowerCase(),
    phone: normalizeText(rawRow.phone),
    specialization: normalizeText(rawRow.specialization),
    capacity: capacity.value,
    status: status.value,
    availabilityStatus: availability.value,
    courses,
    bio: normalizeText(rawRow.bio),
  };

  const parseResult = createTrainerSchema.safeParse(normalizedCandidate);
  if (!parseResult.success) {
    issues.push(...mapCsvImportZodIssues(parseResult.error.issues));
  }

  return {
    rowNumber,
    status: issues.length === 0 && parseResult.success ? "create" : "error",
    input: rawRow,
    normalizedEmail: normalizedCandidate.email || null,
    normalizedEmployeeCode: normalizedCandidate.employeeCode || null,
    normalizedData: issues.length === 0 && parseResult.success ? { rowNumber, ...parseResult.data } : null,
    issues,
  };
}

function detectDuplicateTrainerRows(rows: TrainerImportRow[]) {
  const keyConfigs = [
    {
      field: "email",
      getValue: (row: TrainerImportRow) => row.normalizedEmail,
      message: (rowNumbers: number[]) => `Duplicate email in upload file. Rows: ${rowNumbers.join(", ")}.`,
    },
    {
      field: "employeeCode",
      getValue: (row: TrainerImportRow) => row.normalizedEmployeeCode,
      message: (rowNumbers: number[]) => `Duplicate employee code in upload file. Rows: ${rowNumbers.join(", ")}.`,
    },
  ] as const;

  return keyConfigs.reduce((currentRows, config) => {
    const rowNumbersByValue = new Map<string, number[]>();

    for (const row of currentRows) {
      const value = config.getValue(row);
      if (!value || row.issues.length > 0) {
        continue;
      }

      const existing = rowNumbersByValue.get(value) ?? [];
      existing.push(row.rowNumber);
      rowNumbersByValue.set(value, existing);
    }

    return currentRows.map((row) => {
      const value = config.getValue(row);
      if (!value || row.issues.length > 0) {
        return row;
      }

      const duplicates = rowNumbersByValue.get(value) ?? [];
      if (duplicates.length <= 1) {
        return row;
      }

      return {
        ...row,
        status: "error" as const,
        normalizedData: null,
        issues: [...row.issues, mapCsvImportIssue(config.field, config.message(duplicates))],
      } satisfies TrainerImportRow;
    });
  }, rows);
}

async function validateTrainerCourses(rows: TrainerImportRow[]) {
  const courseSelections = rows.flatMap((row) => row.normalizedData?.courses ?? []);
  const lookup = await loadTrainerCourseLookup(courseSelections);

  return rows.map((row) => {
    if (!row.normalizedData) {
      return row;
    }

    try {
      resolveTrainerCoursesFromLookup(row.normalizedData.courses, lookup);
      return row;
    } catch (error) {
      return {
        ...row,
        status: "error" as const,
        normalizedData: null,
        issues: [...row.issues, mapCsvImportIssue("courses", error instanceof Error ? error.message : "Invalid course selection.")],
      } satisfies TrainerImportRow;
    }
  });
}

async function markExistingTrainerConflicts(rows: TrainerImportRow[]) {
  const emails = Array.from(new Set(rows.flatMap((row) => (row.normalizedData?.email ? [row.normalizedData.email] : []))));
  const employeeCodes = Array.from(
    new Set(rows.flatMap((row) => (row.normalizedData?.employeeCode ? [row.normalizedData.employeeCode] : []))),
  );

  const [existingUsers, existingProfiles] = await Promise.all([
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
    employeeCodes.length > 0
      ? prisma.trainerProfile.findMany({
          where: {
            OR: employeeCodes.map((employeeCode) => ({
              employeeCode: { equals: employeeCode, mode: "insensitive" },
            })),
          },
          select: { employeeCode: true },
        })
      : Promise.resolve([] as Array<{ employeeCode: string }>),
  ]);

  const existingEmailSet = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));
  const existingEmployeeCodeSet = new Set(existingProfiles.map((profile) => profile.employeeCode.trim().toUpperCase()));

  return rows.map((row) => {
    if (!row.normalizedData) {
      return row;
    }

    const issues = [...row.issues];

    if (existingEmailSet.has(row.normalizedData.email)) {
      issues.push(mapCsvImportIssue("email", "Email already exists."));
    }

    if (existingEmployeeCodeSet.has(row.normalizedData.employeeCode)) {
      issues.push(mapCsvImportIssue("employeeCode", "Employee code already exists."));
    }

    if (issues.length === row.issues.length) {
      return row;
    }

    return {
      ...row,
      status: "error" as const,
      normalizedData: null,
      issues,
    } satisfies TrainerImportRow;
  });
}

function ensureUniqueTrainerCommitKeys(rows: CommitTrainerImportInput["rows"]) {
  const keyConfigs = [
    {
      label: "email",
      getValue: (row: CommitTrainerImportInput["rows"][number]) => row.email.trim().toLowerCase(),
    },
    {
      label: "employee code",
      getValue: (row: CommitTrainerImportInput["rows"][number]) => normalizeTrainerEmployeeCode(row.employeeCode),
    },
  ] as const;

  for (const config of keyConfigs) {
    const rowNumbersByValue = new Map<string, number[]>();

    for (const row of rows) {
      const value = config.getValue(row);
      const existing = rowNumbersByValue.get(value) ?? [];
      existing.push(row.rowNumber);
      rowNumbersByValue.set(value, existing);
    }

    const duplicateRows = [...rowNumbersByValue.values()].filter((rowNumbers) => rowNumbers.length > 1);
    if (duplicateRows.length > 0) {
      throw new Error(`Upload contains duplicate ${config.label} values. Fix rows ${duplicateRows.flat().join(", ")} and preview again.`);
    }
  }
}

async function assertNoExistingTrainerConflicts(rows: CommitTrainerImportInput["rows"]) {
  const emails = Array.from(new Set(rows.map((row) => row.email.trim().toLowerCase())));
  const employeeCodes = Array.from(new Set(rows.map((row) => normalizeTrainerEmployeeCode(row.employeeCode))));

  const [existingUsers, existingProfiles] = await Promise.all([
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
    employeeCodes.length > 0
      ? prisma.trainerProfile.findMany({
          where: {
            OR: employeeCodes.map((employeeCode) => ({
              employeeCode: { equals: employeeCode, mode: "insensitive" },
            })),
          },
          select: { employeeCode: true },
        })
      : Promise.resolve([] as Array<{ employeeCode: string }>),
  ]);

  const existingEmailSet = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));
  const existingEmployeeCodeSet = new Set(existingProfiles.map((profile) => profile.employeeCode.trim().toUpperCase()));

  const emailConflicts = rows.filter((row) => existingEmailSet.has(row.email.trim().toLowerCase())).map((row) => row.rowNumber);
  if (emailConflicts.length > 0) {
    throw new Error(`Email already exists for rows ${emailConflicts.join(", ")}. Preview again before importing.`);
  }

  const employeeCodeConflicts = rows
    .filter((row) => existingEmployeeCodeSet.has(normalizeTrainerEmployeeCode(row.employeeCode)))
    .map((row) => row.rowNumber);
  if (employeeCodeConflicts.length > 0) {
    throw new Error(`Employee code already exists for rows ${employeeCodeConflicts.join(", ")}. Preview again before importing.`);
  }
}

async function assertTrainerCoursesStillValid(rows: CommitTrainerImportInput["rows"]) {
  const courseLookup = await loadTrainerCourseLookup(rows.flatMap((row) => row.courses));

  for (const row of rows) {
    try {
      resolveTrainerCoursesFromLookup(row.courses, courseLookup);
    } catch (error) {
      throw new Error(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : "Invalid course selection."}`);
    }
  }
}

export async function previewTrainerImportService(
  input: PreviewTrainerImportInput,
  options?: { actorUserId?: string | null },
): Promise<TrainerImportPreview> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const parsedRows = parseCsvRows(input.csvText);
  const headerRow = parsedRows[0];

  if (!headerRow || headerRow.every((value) => value.trim().length === 0)) {
    throw new Error("CSV must include a header row.");
  }

  const headerIndexes = buildCsvHeaderIndexes(headerRow, TRAINER_IMPORT_HEADERS);
  const rawRows = parsedRows
    .slice(1)
    .map((row) => buildCsvRowRecord(row, headerIndexes, TRAINER_IMPORT_HEADERS))
    .map((row) => ({ ...createEmptyTrainerImportRowInput(), ...row }))
    .filter((row) => !isBlankCsvRow(row));

  if (rawRows.length === 0) {
    throw new Error("CSV must include at least one trainer row.");
  }

  if (rawRows.length > TRAINER_IMPORT_MAX_ROWS) {
    throw new Error(`Upload at most ${TRAINER_IMPORT_MAX_ROWS} rows at a time.`);
  }

  const previewRows = rawRows.map((rawRow, index) => buildTrainerPreviewRow(rawRow, index + 2));
  const deduplicatedRows = detectDuplicateTrainerRows(previewRows);
  const rowsWithValidCourses = await validateTrainerCourses(deduplicatedRows);
  const rowsWithConflicts = await markExistingTrainerConflicts(rowsWithValidCourses);
  const preview = buildTrainerPreviewSummary(input.fileName, rowsWithConflicts);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: input.fileName,
    action: AUDIT_ACTION_TYPE.UPDATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Previewed trainer bulk import ${input.fileName}.`,
    metadata: {
      domain: "TRAINER_BULK_IMPORT",
      fileName: input.fileName,
      totalRows: preview.totalRows,
      createCount: preview.createCount,
      errorCount: preview.errorCount,
    },
  });

  return preview;
}

export async function commitTrainerImportService(
  input: CommitTrainerImportInput,
  options?: { actorUserId?: string | null },
): Promise<TrainerImportCommitResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  ensureUniqueTrainerCommitKeys(input.rows);
  await assertNoExistingTrainerConflicts(input.rows);
  await assertTrainerCoursesStillValid(input.rows);

  let createdCount = 0;

  for (const row of input.rows) {
    try {
      await createTrainerService(
        {
          department: "",
          jobTitle: "",
          skills: [],
          certifications: [],
          preferredLanguage: "",
          timeZone: "",
          ...row,
        },
        { actorUserId: options?.actorUserId ?? undefined },
      );
      createdCount += 1;
    } catch (error) {
      throw new Error(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : "Unable to create trainer."}`);
    }
  }

  const result = {
    fileName: input.fileName,
    createdCount,
    totalCount: createdCount,
  } satisfies TrainerImportCommitResult;

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: input.fileName,
    action: AUDIT_ACTION_TYPE.CREATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Imported ${result.totalCount} trainer row(s).`,
    metadata: {
      domain: "TRAINER_BULK_IMPORT",
      fileName: input.fileName,
      createdCount: result.createdCount,
      totalCount: result.totalCount,
      rowCount: input.rows.length,
    },
  });

  return result;
}