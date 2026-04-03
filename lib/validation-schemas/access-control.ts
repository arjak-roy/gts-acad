import { z } from "zod";

import { assignableStaffModuleKeys } from "@/lib/auth/module-access";

export const assignModulesSchema = z.object({
  modules: z.array(z.enum(assignableStaffModuleKeys)).max(assignableStaffModuleKeys.length),
});