import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-response";
import { resolveStoredAssetResponse } from "@/services/file-upload";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get("provider") ?? undefined;
    const storagePath = String(request.nextUrl.searchParams.get("path") ?? "").trim();

    if (!storagePath) {
      throw new Error("Asset path is required.");
    }

    const asset = await resolveStoredAssetResponse({
      storageProvider: provider,
      storagePath,
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

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
