import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { contentIdSchema } from "@/lib/validation-schemas/course-content";
import { exportContentAsDocx, exportContentAsHtml } from "@/services/course-content/export";

type RouteContext = { params: { contentId: string } };

const ALLOWED_FORMATS = new Set(["docx", "html"]);

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "course_content.view");
    const { contentId } = contentIdSchema.parse(params);

    const format = request.nextUrl.searchParams.get("format")?.toLowerCase() ?? "docx";
    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json({ error: "Invalid format. Use docx or html." }, { status: 400 });
    }

    const result = format === "html"
      ? await exportContentAsHtml(contentId)
      : await exportContentAsDocx(contentId);

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
        "Content-Length": String(result.buffer.byteLength),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
