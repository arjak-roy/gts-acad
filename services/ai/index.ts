import "server-only";

export {
  generateQuestionsService,
  streamGenerateQuestions,
  createAiAssessmentService,
  assertAiEnabled,
} from "@/services/ai/question-generator";

export type {
  AiGenerateQuestionsRequest,
  AiGenerateQuestionsResponse,
  AiCreateAssessmentRequest,
  AiCreateAssessmentResponse,
  AiGeneratedQuestion,
} from "@/services/ai/types";
