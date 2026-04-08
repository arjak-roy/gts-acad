import { z } from "zod";

const centerSchemaObject = z.object({
  name: z.string().trim().min(2).max(255),
  addressLine1: z.string().trim().min(2).max(255),
  addressLine2: z.string().trim().max(255).optional().default(""),
  landmark: z.string().trim().max(255).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  countryId: z.coerce.number().int().min(1),
  stateId: z.coerce.number().int().min(1),
  cityId: z.coerce.number().int().min(1),
  totalCapacity: z.coerce.number().int().min(0).max(100000).optional().default(0),
  currentUtilization: z.coerce.number().int().min(0).max(100000).optional().default(0),
  complianceStatus: z.enum(["pending", "compliant", "review_required"]).default("pending"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

function withCapacityValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((input: z.infer<typeof centerSchemaObject>, context) => {
    if (input.currentUtilization > input.totalCapacity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentUtilization"],
        message: "Current utilization cannot exceed total capacity.",
      });
    }
  });
}

export const createCenterSchema = withCapacityValidation(centerSchemaObject);

export const updateCenterSchema = withCapacityValidation(
  centerSchemaObject.extend({
    centerId: z.string().trim().min(1),
  }),
);

export const centerIdSchema = z.object({
  centerId: z.string().trim().min(1),
});

export type CreateCenterInput = z.infer<typeof createCenterSchema>;
export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;