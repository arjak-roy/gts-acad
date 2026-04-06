export const CUSTOM_EMAIL_TEMPLATE_KEY_VALUE = "__custom__";

export const TWO_FACTOR_EMAIL_TEMPLATE_KEY = "auth-2fa-code";
export const PASSWORD_RESET_EMAIL_TEMPLATE_KEY = "auth-password-reset";
export const ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY = "auth-account-activation";
export const INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY = "internal-user-password-changed";
export const CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY = "candidate-welcome-credentials";
export const INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY = "internal-user-welcome-credentials";

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
];

export function getEmailTemplateKeyOption(key: string) {
  return EMAIL_TEMPLATE_KEY_OPTIONS.find((option) => option.key === key) ?? null;
}