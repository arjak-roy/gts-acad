import { apiError, apiSuccess } from "@/lib/api-response";
import { getRuntimeSettingValue } from "@/services/settings/runtime";

export async function GET() {
  try {
    const enabled = await getRuntimeSettingValue<boolean>("ai.enable_ai_features", false);
    return apiSuccess({ enabled: Boolean(enabled) });
  } catch {
    return apiSuccess({ enabled: false });
  }
}
