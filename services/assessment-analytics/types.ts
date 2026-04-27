export type AssessmentSummaryReport = {
  assessmentPoolId: string;
  assessmentCode: string;
  assessmentTitle: string;
  questionType: string;
  difficultyLevel: string;
  totalAssignedLearners: number;
  totalAttempts: number;
  completedAttempts: number;
  passRate: number;
  failRate: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  pendingReviewCount: number;
};

export type LearnerPerformanceRow = {
  learnerId: string;
  learnerCode: string;
  learnerName: string;
  assessmentPoolId: string;
  assessmentTitle: string;
  attemptCount: number;
  latestScore: number | null;
  highestScore: number | null;
  passed: boolean | null;
  completionDate: string | null;
  status: string;
};

export type LearnerPerformanceReport = {
  rows: LearnerPerformanceRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type QuestionAnalyticsRow = {
  questionId: string;
  questionText: string;
  questionType: string;
  marks: number;
  timesAnswered: number;
  correctRate: number;
  incorrectRate: number;
  skippedCount: number;
  averageMarksEarned: number;
  mostSelectedWrongAnswer: unknown;
  isLowSuccess: boolean;
};

export type PassFailStats = {
  passed: number;
  failed: number;
  pendingReview: number;
  passedPercentage: number;
  failedPercentage: number;
  pendingPercentage: number;
};

export type TrendDataPoint = {
  period: string;
  label: string;
  attempts: number;
  averageScore: number;
  passRate: number;
};

export type DifficultQuestion = {
  questionId: string;
  questionText: string;
  questionType: string;
  correctRate: number;
  failRate: number;
  skippedCount: number;
  assessmentPoolId: string;
  assessmentTitle: string;
};

export type LearnerComparisonRow = {
  learnerId: string;
  learnerCode: string;
  learnerName: string;
  averageScore: number;
  totalAttempts: number;
  passedCount: number;
  failedCount: number;
};

export type DashboardAnalyticsWidgets = {
  averageQuizScore: number;
  passRate: number;
  totalQuizAttempts: number;
  pendingReviewCount: number;
};
