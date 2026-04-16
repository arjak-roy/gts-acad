import { buildTemplateCsv, BULK_IMPORT_MAX_FILE_SIZE_BYTES, BULK_IMPORT_MAX_ROWS } from "@/lib/bulk-import/csv";

export const TRAINER_IMPORT_HEADERS = [
  "fullName",
  "employeeCode",
  "email",
  "phone",
  "specialization",
  "capacity",
  "status",
  "availabilityStatus",
  "courses",
  "bio",
] as const;

export type TrainerImportHeader = (typeof TRAINER_IMPORT_HEADERS)[number];

export const TRAINER_IMPORT_MAX_ROWS = BULK_IMPORT_MAX_ROWS;
export const TRAINER_IMPORT_MAX_FILE_SIZE_BYTES = BULK_IMPORT_MAX_FILE_SIZE_BYTES;
export const TRAINER_IMPORT_TEMPLATE_FILE_NAME = "trainers-bulk-upload-template.csv";

export function buildTrainerImportTemplateCsv() {
  return buildTemplateCsv(TRAINER_IMPORT_HEADERS, [
    [
      "Ava Müller",
      "TRN-1001",
      "ava.mueller@gtsacademy.com",
      "+49 151 555 1200",
      "German for Healthcare",
      "24",
      "ACTIVE",
      "AVAILABLE",
      "German A1; German B1 Nursing",
      "Focuses on spoken fluency and healthcare communication.",
    ],
  ]);
}