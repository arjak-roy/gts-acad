import { getAuthenticationSecurityRuntimeSettings } from "@/services/settings/runtime";

async function getPasswordPolicyConfiguration() {
  const settings = await getAuthenticationSecurityRuntimeSettings();
  const minimumLength = Math.min(Math.max(settings.passwordMinimumLength, 8), 128);
  const requirements = settings.passwordComplexityRequirement.length > 0
    ? settings.passwordComplexityRequirement
    : ["UPPERCASE", "LOWERCASE", "NUMBER", "SPECIAL"];

  return {
    minimumLength,
    requirements,
  };
}

export async function getPasswordPolicyRequirements() {
  const configuration = await getPasswordPolicyConfiguration();

  return [
    `At least ${configuration.minimumLength} characters`,
    ...(configuration.requirements.includes("UPPERCASE") ? ["At least one uppercase letter"] : []),
    ...(configuration.requirements.includes("LOWERCASE") ? ["At least one lowercase letter"] : []),
    ...(configuration.requirements.includes("NUMBER") ? ["At least one number"] : []),
    ...(configuration.requirements.includes("SPECIAL") ? ["At least one special character"] : []),
  ];
}

export async function getPasswordPolicyErrors(password: string) {
  const configuration = await getPasswordPolicyConfiguration();
  const errors: string[] = [];

  if (password.length < configuration.minimumLength) {
    errors.push(`Password must be at least ${configuration.minimumLength} characters long.`);
  }

  if (configuration.requirements.includes("UPPERCASE") && !/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter.");
  }

  if (configuration.requirements.includes("LOWERCASE") && !/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter.");
  }

  if (configuration.requirements.includes("NUMBER") && !/[0-9]/.test(password)) {
    errors.push("Password must include at least one number.");
  }

  if (configuration.requirements.includes("SPECIAL") && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include at least one special character.");
  }

  return errors;
}

export async function getPasswordPolicyHint() {
  const requirements = await getPasswordPolicyRequirements();
  return requirements.join(", ");
}

export async function assertPasswordPolicy(password: string) {
  const errors = await getPasswordPolicyErrors(password);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
}