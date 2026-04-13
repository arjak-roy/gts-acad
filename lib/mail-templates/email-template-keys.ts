export const CUSTOM_EMAIL_TEMPLATE_KEY_VALUE = "__custom__";

export const TWO_FACTOR_EMAIL_TEMPLATE_KEY = "auth-2fa-code";
export const PASSWORD_RESET_EMAIL_TEMPLATE_KEY = "auth-password-reset";
export const ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY = "auth-account-activation";
export const INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY = "internal-user-password-changed";
export const CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY = "candidate-welcome-credentials";
export const INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY = "internal-user-welcome-credentials";
export const USER_INVITATION_EMAIL_TEMPLATE_KEY = "user-invitation";
export const COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY = "course-enrollment-confirmation";
export const BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY = "buddy-persona-available";
export const COURSE_COMPLETION_EMAIL_TEMPLATE_KEY = "course-completion";
export const BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY = "batch-event-notification";
export const ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY = "assessment-scheduled";
export const ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY = "assessment-completed";
export const ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY = "assessment-result";
export const QUIZ_ASSIGNED_EMAIL_TEMPLATE_KEY = "quiz-assigned";
export const QUIZ_RESULT_EMAIL_TEMPLATE_KEY = "quiz-result";
export const TRAINER_ASSIGNMENT_EMAIL_TEMPLATE_KEY = "trainer-assignment";
export const GENERAL_NOTIFICATION_EMAIL_TEMPLATE_KEY = "general-notification";

export type EmailTemplateKeyOption = {
  key: string;
  label: string;
  description: string;
};

export const EMAIL_TEMPLATE_KEY_OPTIONS: EmailTemplateKeyOption[] = [
  {
    key: TWO_FACTOR_EMAIL_TEMPLATE_KEY,
    label: "Two-Factor Verification Code",
    description: "Email used for sign-in verification and two-factor setup challenges.",
  },
  {
    key: PASSWORD_RESET_EMAIL_TEMPLATE_KEY,
    label: "Password Reset Instructions",
    description: "Email used to issue secure password reset links and tokens.",
  },
  {
    key: ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY,
    label: "Account Activation",
    description: "Email used to activate newly provisioned accounts.",
  },
  {
    key: INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY,
    label: "Internal Password Changed Confirmation",
    description: "Email sent to internal users after password reset is completed.",
  },
  {
    key: CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    label: "Candidate Welcome Credentials",
    description: "Email sent when a candidate account is auto-created during enrollment.",
  },
  {
    key: INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    label: "Internal User Welcome Credentials",
    description: "Email sent when an internal user account is created from the admin portal.",
  },
  {
    key: USER_INVITATION_EMAIL_TEMPLATE_KEY,
    label: "User Invitation",
    description: "Email sent when a user is invited to join the platform.",
  },
  {
    key: COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY,
    label: "Course Enrollment Confirmation",
    description: "Email confirming successful enrollment in a course.",
  },
  {
    key: BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY,
    label: "Buddy Persona Available",
    description: "Email sent when a course-specific Buddy persona is available to the learner.",
  },
  {
    key: COURSE_COMPLETION_EMAIL_TEMPLATE_KEY,
    label: "Course Completion",
    description: "Email sent when a learner completes a course.",
  },
  {
    key: BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY,
    label: "Batch Event Notification",
    description: "Email sent to candidates when a new batch event is scheduled.",
  },
  {
    key: ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY,
    label: "Assessment Scheduled",
    description: "Email sent when a new assessment is scheduled for a batch.",
  },
  {
    key: ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY,
    label: "Assessment Completed",
    description: "Email sent after a candidate submits an assessment.",
  },
  {
    key: ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY,
    label: "Assessment Result",
    description: "Email sent when an assessment result is available, including reviewer context.",
  },
  {
    key: QUIZ_ASSIGNED_EMAIL_TEMPLATE_KEY,
    label: "Quiz Assigned",
    description: "Email sent when a quiz is assigned to a learner.",
  },
  {
    key: QUIZ_RESULT_EMAIL_TEMPLATE_KEY,
    label: "Quiz Result",
    description: "Email sent with quiz results after completion.",
  },
  {
    key: TRAINER_ASSIGNMENT_EMAIL_TEMPLATE_KEY,
    label: "Trainer Assignment",
    description: "Email sent when a trainer is assigned to a batch or course.",
  },
  {
    key: GENERAL_NOTIFICATION_EMAIL_TEMPLATE_KEY,
    label: "General Notification",
    description: "General-purpose notification email template.",
  },
];

export function getEmailTemplateKeyOption(key: string) {
  return EMAIL_TEMPLATE_KEY_OPTIONS.find((option) => option.key === key) ?? null;
}