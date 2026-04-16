import { buildTemplateCsv, BULK_IMPORT_MAX_FILE_SIZE_BYTES, BULK_IMPORT_MAX_ROWS } from "@/lib/bulk-import/csv";

export const LEARNER_IMPORT_HEADERS = [
  "fullName",
  "email",
  "phone",
  "programName",
  "batchCode",
  "campus",
] as const;

export type LearnerImportHeader = (typeof LEARNER_IMPORT_HEADERS)[number];

export const LEARNER_IMPORT_MAX_ROWS = BULK_IMPORT_MAX_ROWS;
export const LEARNER_IMPORT_MAX_FILE_SIZE_BYTES = BULK_IMPORT_MAX_FILE_SIZE_BYTES;
export const LEARNER_IMPORT_TEMPLATE_FILE_NAME = "learners-bulk-upload-template.csv";

export function buildLearnerImportTemplateCsv() {
  return buildTemplateCsv(LEARNER_IMPORT_HEADERS, [
    [
      "Noah Fischer",
      "noah.fischer@example.com",
      "+49 171 555 9988",
      "German Accelerator",
      "B-GER-NOV",
      "Berlin",
    ],
  ]);
}