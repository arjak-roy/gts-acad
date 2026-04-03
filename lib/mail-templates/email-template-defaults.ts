export const TWO_FACTOR_EMAIL_TEMPLATE_KEY = "auth-2fa-code";
export const PASSWORD_RESET_EMAIL_TEMPLATE_KEY = "auth-password-reset";
export const CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY = "candidate-welcome-credentials";

export type EmailTemplateSource = {
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlContent: string;
  textContent: string;
  isSystem: boolean;
  isActive: boolean;
};

export type TemplateVariableValue = string | number | boolean | null | undefined;
export type TemplateVariables = Record<string, TemplateVariableValue>;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSource[] = [
  {
    key: TWO_FACTOR_EMAIL_TEMPLATE_KEY,
    name: "Two-Factor Verification Code",
    description: "Email used for sign-in verification and two-factor setup challenges.",
    subject: "{{appName}} verification code",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Use the verification code below to {{purposeLabel}}:",
      "",
      "{{code}}",
      "",
      "This code expires in {{expiresInMinutes}} minutes.",
      "If you did not request this code, you can ignore this email.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Verification code</h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, use the code below to {{purposeLabel}}.</p>
          <div style="margin: 0 0 24px; border-radius: 18px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; text-align: center;">
            <div style="font-size: 30px; font-weight: 800; letter-spacing: 0.4em; color: #0f172a;">{{code}}</div>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #475569;">This code expires in {{expiresInMinutes}} minutes.</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">If you did not request this code, you can ignore this email.</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: PASSWORD_RESET_EMAIL_TEMPLATE_KEY,
    name: "Password Reset Instructions",
    description: "Email used to issue secure password reset links and tokens.",
    subject: "Reset your {{appName}} password",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "We received a request to reset your password.",
      "",
      "Reset link:",
      "{{resetUrl}}",
      "",
      "If the link does not open, use this token:",
      "{{resetToken}}",
      "",
      "This reset token expires in {{expiresInMinutes}} minutes.",
      "If you did not request this reset, you can ignore this email.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Reset your password</h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, we received a request to reset your password.</p>
          <a href="{{resetUrl}}" style="display: inline-block; margin-bottom: 20px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Reset password</a>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Reset token:</strong> {{resetToken}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Expires in:</strong> {{expiresInMinutes}} minutes</p>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">If you did not request this reset, you can ignore this email.</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    name: "Candidate Welcome Credentials",
    description: "Email sent when a candidate account is auto-created during enrollment.",
    subject: "Welcome to {{appName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Your candidate account has been created.",
      "",
      "Learner code: {{learnerCode}}",
      "Program: {{programName}}",
      "Login email: {{recipientEmail}}",
      "Temporary password: {{temporaryPassword}}",
      "",
      "Login here: {{loginUrl}}",
      "",
      "For security, please sign in and reset your password immediately.",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Welcome aboard</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your candidate account is now ready.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Learner code:</strong> {{learnerCode}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Login email:</strong> {{recipientEmail}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Temporary password:</strong> {{temporaryPassword}}</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">Sign in here: <a href="{{loginUrl}}" style="color: #0d3b84;">{{loginUrl}}</a></p>
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.6; color: #475569;">For security, please reset your password immediately after your first login.</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
];

const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

function stringifyTemplateValue(value: TemplateVariableValue) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function interpolateTemplate(source: string, variables: TemplateVariables, escapeValues: boolean) {
  return source.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = stringifyTemplateValue(variables[key]);
    return escapeValues ? escapeHtml(value) : value;
  });
}

export function extractTemplateVariables(...sources: Array<string | null | undefined>) {
  const matches = new Set<string>();

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
  }

  return Array.from(matches).sort((left, right) => left.localeCompare(right));
}

export function stripHtmlToText(source: string) {
  return source
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getDefaultEmailTemplate(key: string) {
  return DEFAULT_EMAIL_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function renderEmailTemplateSource(template: Pick<EmailTemplateSource, "subject" | "htmlContent" | "textContent">, variables: TemplateVariables) {
  const textTemplate = template.textContent.trim() || stripHtmlToText(template.htmlContent);

  return {
    subject: interpolateTemplate(template.subject, variables, false),
    text: interpolateTemplate(textTemplate, variables, false),
    html: interpolateTemplate(template.htmlContent, variables, true),
  };
}