import "server-only";

export {
  listAssessmentPoolsService,
  getAssessmentPoolByIdService,
  listQuestionsService,
} from "@/services/assessment-pool/queries";

export {
  generateAssessmentPoolCode,
  createAssessmentPoolService,
  updateAssessmentPoolService,
  publishAssessmentPoolService,
  archiveAssessmentPoolService,
  addQuestionService,
  updateQuestionService,
  deleteQuestionService,
} from "@/services/assessment-pool/commands";

export { gradeSubmissionService } from "@/services/assessment-pool/grading";
export {
  getCandidateAssessmentDetailService,
  saveCandidateAssessmentDraftService,
  submitCandidateAssessmentService,
} from "@/services/assessment-pool/candidate";
export { generateAssessmentWithAi } from "@/services/assessment-pool/ai-stubs";

export type {
  AssessmentPoolCreateResult,
  CandidateAssessmentAttemptSummary,
  CandidateAssessmentAvailabilityStatus,
  CandidateAssessmentDraftSaveResult,
  CandidateAssessmentDetail,
  CandidateAssessmentQuestion,
  CandidateAssessmentSavedAnswer,
  CandidateAssessmentSubmissionResult,
  AssessmentPoolDetail,
  AssessmentPoolListItem,
  GradeResult,
  GradingReport,
  QuestionDetail,
} from "@/services/assessment-pool/types";
