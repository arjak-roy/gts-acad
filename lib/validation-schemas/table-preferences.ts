import { z } from "zod";

import { MAX_TABLE_PAGE_SIZE } from "@/lib/table-preferences";

export const tablePreferenceParamsSchema = z.object({
  tableKey: z
    .string()
    .trim()
    .min(1, "Table key is required.")
    .max(120, "Table key is too long.")
    .regex(/^[A-Za-z0-9:_-]+$/, "Table key contains unsupported characters."),
});

export const updateTablePreferenceSchema = z
  .object({
    pageSize: z.union([z.coerce.number().int().min(1).max(MAX_TABLE_PAGE_SIZE), z.null()]).optional(),
    hiddenColumnIds: z.union([
      z.array(z.string().trim().min(1).max(100)).max(100),
      z.null(),
    ]).optional(),
  })
  .refine((value) => value.pageSize !== undefined || value.hiddenColumnIds !== undefined, {
    message: "At least one preference field is required.",
  });

export type UpdateTablePreferenceInput = z.infer<typeof updateTablePreferenceSchema>;
