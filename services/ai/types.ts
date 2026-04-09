/** Request to preview AI-generated questions (not yet persisted). */
export type AiGenerateQuestionsRequest = {
  prompt: string;
  questionType: string;
  questionTypes?: string[];
  questionCount: number;
  difficultyLevel: string;
  courseId?: string;
};

/** A single AI-generated question payload, ready for preview or insertion. */
export type AiGeneratedQuestion = {
  questionText: string;
  questionType: string;
  options?: unknown;
  correctAnswer?: unknown;
  explanation: string;
  marks: number;
};

/** Response from the AI generation preview step. */
export type AiGenerateQuestionsResponse = {
  questions: AiGeneratedQuestion[];
  model: string;
  promptTokens: number;
  completionTokens: number;
};

/** Request to persist AI-generated questions into a new assessment pool. */
export type AiCreateAssessmentRequest = {
  title: string;
  description?: string;
  prompt: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes?: number | null;
  courseId?: string;
  questions: AiGeneratedQuestion[];
};

/** Response after persisting an AI-generated assessment pool. */
export type AiCreateAssessmentResponse = {
  poolId: string;
  questionCount: number;
};
