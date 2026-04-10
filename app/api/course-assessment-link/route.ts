import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { linkAssessmentToCourseSchema } from "@/lib/validation-schemas/assessment-pool";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.view");
    const courseId = request.nextUrl.searchParams.get("courseId");
    const assessmentPoolId = request.nextUrl.searchParams.get("assessmentPoolId");

    if (!isDatabaseConfigured) return apiSuccess([]);

    const where = {
      ...(courseId ? { courseId } : {}),
      ...(assessmentPoolId ? { assessmentPoolId } : {}),
    };
    const links = await prisma.courseAssessmentLink.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        courseId: true,
        assessmentPoolId: true,
        sortOrder: true,
        isRequired: true,
        createdAt: true,
        course: { select: { name: true } },
        assessmentPool: { select: { title: true, code: true, questionType: true, status: true } },
      },
    });

    return apiSuccess(links);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = linkAssessmentToCourseSchema.parse(body);

    if (!isDatabaseConfigured) throw new Error("Database not configured.");

    const link = await prisma.courseAssessmentLink.upsert({
      where: {
        courseId_assessmentPoolId: {
          courseId: input.courseId,
          assessmentPoolId: input.assessmentPoolId,
        },
      },
      update: {
        sortOrder: input.sortOrder,
        isRequired: input.isRequired,
      },
      create: {
        courseId: input.courseId,
        assessmentPoolId: input.assessmentPoolId,
        sortOrder: input.sortOrder,
        isRequired: input.isRequired,
      },
      select: {
        id: true,
        courseId: true,
        assessmentPoolId: true,
        sortOrder: true,
        isRequired: true,
      },
    });

    return apiSuccess(link, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const { courseId, assessmentPoolId } = linkAssessmentToCourseSchema.parse(body);

    if (!isDatabaseConfigured) throw new Error("Database not configured.");

    await prisma.courseAssessmentLink.deleteMany({
      where: { courseId, assessmentPoolId },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
