import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { aiGeneratePreviewSchema, aiCreateAssessmentSchema } from "@/lib/validation-schemas/ai";
import { generateQuestionsService, createAiAssessmentService } from "@/services/ai";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "assessment_pool.create");
    const body = await request.json() as Record<string, unknown>;
    const mode = body.mode;

    if (mode === "preview") {
      const input = aiGeneratePreviewSchema.parse(body);
      const result = await generateQuestionsService({
        prompt: input.prompt,
        questionType: input.questionType,
        questionCount: input.questionCount,
        difficultyLevel: input.difficultyLevel,
        courseId: input.courseId,
      });
      return apiSuccess(result);
    }

    if (mode === "create") {
      const input = aiCreateAssessmentSchema.parse(body);
      const result = await createAiAssessmentService(
        {
          title: input.title,
          description: input.description,
          prompt: input.prompt,
          questionType: input.questionType,
          difficultyLevel: input.difficultyLevel,
          totalMarks: input.totalMarks,
          passingMarks: input.passingMarks,
          timeLimitMinutes: input.timeLimitMinutes,
          courseId: input.courseId,
          questions: input.questions,
        },
        { actorUserId: session.userId },
      );
      return apiSuccess(result, { status: 201 });
    }

    return apiError(new Error("Invalid mode. Use 'preview' or 'create'."));
  } catch (error) {
    return apiError(error);
  }
}
