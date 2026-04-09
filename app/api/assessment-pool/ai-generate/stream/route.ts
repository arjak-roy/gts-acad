import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/route-guards";
import { aiGeneratePreviewSchema } from "@/lib/validation-schemas/ai";
import { streamGenerateQuestions } from "@/services/ai";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.create");
    const body = (await request.json()) as Record<string, unknown>;
    const input = aiGeneratePreviewSchema.parse(body);

    const questionTypes = Array.isArray(body.questionTypes)
      ? (body.questionTypes as string[]).filter((t) => typeof t === "string" && t.length > 0)
      : undefined;

    const generator = streamGenerateQuestions({
      prompt: input.prompt,
      questionType: input.questionType,
      questionTypes,
      questionCount: input.questionCount,
      difficultyLevel: input.difficultyLevel,
      courseId: input.courseId,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of generator) {
            const line = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
          controller.close();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Stream failed.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}
