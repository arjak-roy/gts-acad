export const CANDIDATE_ATTEMPT_FEEDBACK_TYPE = "candidate-assessment-submission";

export type CandidateAttemptFeedback = {
  type: typeof CANDIDATE_ATTEMPT_FEEDBACK_TYPE;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
};

export function parseCandidateAttemptFeedback(feedback: string | null) {
  if (!feedback) {
    return null;
  }

  try {
    const parsed = JSON.parse(feedback) as CandidateAttemptFeedback;

    if (parsed?.type !== CANDIDATE_ATTEMPT_FEEDBACK_TYPE) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function buildCandidateAttemptFeedback(report: {
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
}) {
  return JSON.stringify({
    type: CANDIDATE_ATTEMPT_FEEDBACK_TYPE,
    marksObtained: report.marksObtained,
    totalMarks: report.totalMarks,
    percentage: report.percentage,
    passed: report.passed,
  } satisfies CandidateAttemptFeedback);
}