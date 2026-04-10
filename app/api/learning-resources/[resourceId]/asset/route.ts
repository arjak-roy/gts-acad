import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { resourceIdSchema } from "@/lib/validation-schemas/learning-resources";
import { getLearningResourceAssetService } from "@/services/learning-resource-service";

export const runtime = "nodejs";

type RouteContext = { params: { resourceId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "learning_resources.view");
    const { resourceId } = resourceIdSchema.parse(params);
    const attachmentId = request.nextUrl.searchParams.get("attachmentId") ?? undefined;
    const download = request.nextUrl.searchParams.get("download") === "1";
    const asset = await getLearningResourceAssetService(resourceId, {
      attachmentId,
      download,
      actorUserId: session.userId,
    });

    if (!asset) {
      throw new Error("Resource asset not found.");
    }

    if (asset.kind === "redirect") {
      return Response.redirect(asset.url, 302);
    }

    return new Response(asset.body, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": asset.cacheControl,
        ...(download
          ? { "Content-Disposition": `attachment; filename="${asset.fileName.replace(/\"/g, "")}"` }
          : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}