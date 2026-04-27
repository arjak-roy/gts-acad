import { promises as fs } from "node:fs";
import path from "node:path";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/auth/route-guards";
import { apiError } from "@/lib/api-response";

const swaggerDocumentPath = path.join(process.cwd(), "docs", "swagger-admin.json");

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedSession(request);

    const documentText = await fs.readFile(swaggerDocumentPath, "utf8");

    return new NextResponse(documentText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
