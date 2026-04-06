const DEFAULT_PASSWORD_MIN_LENGTH = 12;

function getConfiguredPasswordMinLength() {
  const rawValue = Number.parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH ?? "", 10);
  if (!Number.isFinite(rawValue) || rawValue < 8) {
    return DEFAULT_PASSWORD_MIN_LENGTH;
  }

  return Math.min(rawValue, 128);
}

export const PASSWORD_MIN_LENGTH = getConfiguredPasswordMinLength();

export const PASSWORD_POLICY_REQUIREMENTS = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  "At least one uppercase letter",
  "At least one lowercase letter",
  "At least one number",
  "At least one special character",
];

export function getPasswordPolicyErrors(password: string) {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter.");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include at least one special character.");
  }

  return errors;
}

export function getPasswordPolicyHint() {
  return `Use at least ${PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number, and special characters.`;
}

export function assertPasswordPolicy(password: string) {
  const errors = getPasswordPolicyErrors(password);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
}