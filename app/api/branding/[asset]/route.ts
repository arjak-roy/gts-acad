import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-response";
import { parseBrandingAssetSlot, resolveBrandingAssetResponse } from "@/services/file-upload";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    asset: string;
  };
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const slot = parseBrandingAssetSlot(params.asset);
    if (!slot) {
      throw new Error("Branding asset not found.");
    }

    const asset = await resolveBrandingAssetResponse(slot);
    return new Response(asset.body, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": asset.cacheControl,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
