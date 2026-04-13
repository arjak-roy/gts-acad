import {
  ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY,
  BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY,
  BUDDY_EMAIL_ACTION_EMAIL_TEMPLATE_KEY,
  BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY,
  CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
  COURSE_COMPLETION_EMAIL_TEMPLATE_KEY,
  COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY,
  GENERAL_NOTIFICATION_EMAIL_TEMPLATE_KEY,
  INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY,
  INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
  PASSWORD_RESET_EMAIL_TEMPLATE_KEY,
  QUIZ_ASSIGNED_EMAIL_TEMPLATE_KEY,
  QUIZ_RESULT_EMAIL_TEMPLATE_KEY,
  TRAINER_ASSIGNMENT_EMAIL_TEMPLATE_KEY,
  TWO_FACTOR_EMAIL_TEMPLATE_KEY,
  USER_INVITATION_EMAIL_TEMPLATE_KEY,
} from "@/lib/mail-templates/email-template-keys";

export {
  ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY,
  ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY,
  BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY,
  BUDDY_EMAIL_ACTION_EMAIL_TEMPLATE_KEY,
  BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY,
  CANDIDATE_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
  COURSE_COMPLETION_EMAIL_TEMPLATE_KEY,
  COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY,
  GENERAL_NOTIFICATION_EMAIL_TEMPLATE_KEY,
  INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY,
  INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
  PASSWORD_RESET_EMAIL_TEMPLATE_KEY,
  QUIZ_ASSIGNED_EMAIL_TEMPLATE_KEY,
  QUIZ_RESULT_EMAIL_TEMPLATE_KEY,
  TRAINER_ASSIGNMENT_EMAIL_TEMPLATE_KEY,
  TWO_FACTOR_EMAIL_TEMPLATE_KEY,
  USER_INVITATION_EMAIL_TEMPLATE_KEY,
} from "@/lib/mail-templates/email-template-keys";

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
    key: ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY,
    name: "Account Activation",
    description: "Email used to activate newly provisioned accounts.",
    subject: "Activate your {{appName}} account",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Your account is ready, but it must be activated before you can sign in.",
      "",
      "Activate your account:",
      "{{activationUrl}}",
      "",
      "If the link does not open, use this activation token:",
      "{{activationToken}}",
      "",
      "This activation link expires in {{expiresInHours}} hours.",
      "After activation, sign in here: {{loginUrl}}",
      "If you did not expect this email, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Activate your account</h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your account is ready. Activate it before signing in.</p>
          <a href="{{activationUrl}}" style="display: inline-block; margin-bottom: 20px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Activate account</a>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Activation token:</strong> {{activationToken}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Expires in:</strong> {{expiresInHours}} hours</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">Sign in after activation: <a href="{{loginUrl}}" style="color: #0d3b84;">{{loginUrl}}</a></p>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">If you did not expect this email, contact {{supportEmail}}.</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY,
    name: "Internal Password Changed Confirmation",
    description: "Email sent to internal users after password reset is completed.",
    subject: "Your {{appName}} password was changed",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "This is a confirmation that your password was successfully changed on {{changedAt}}.",
      "",
      "If this was you, no further action is needed.",
      "If this was not you, contact {{supportEmail}} immediately.",
      "",
      "Sign in: {{loginUrl}}",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Password changed</h1>
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your password was successfully changed on <strong>{{changedAt}}</strong>.</p>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">If this was you, no further action is needed. If this was not you, contact {{supportEmail}} immediately.</p>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">Sign in here: <a href="{{loginUrl}}" style="color: #0d3b84;">{{loginUrl}}</a></p>
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
  {
    key: INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    name: "Internal User Welcome Credentials",
    description: "Email sent when an internal user account is created from the admin portal.",
    subject: "Your {{appName}} admin account is ready",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Your internal account has been created.",
      "",
      "Login email: {{recipientEmail}}",
      "Temporary password: {{temporaryPassword}}",
      "Assigned roles: {{roleSummary}}",
      "",
      "Login here: {{loginUrl}}",
      "",
      "For security, sign in and change your password immediately.",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Your admin workspace is ready</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your internal access has been provisioned.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Login email:</strong> {{recipientEmail}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Temporary password:</strong> {{temporaryPassword}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Assigned roles:</strong> {{roleSummary}}</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">Sign in here: <a href="{{loginUrl}}" style="color: #0d3b84;">{{loginUrl}}</a></p>
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.6; color: #475569;">For security, change your password immediately after signing in.</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: USER_INVITATION_EMAIL_TEMPLATE_KEY,
    name: "User Invitation",
    description: "Email sent when a user is invited to join the platform.",
    subject: "You are invited to join {{appName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "You have been invited to join {{appName}}.",
      "",
      "Click the link below to set up your account:",
      "{{invitationUrl}}",
      "",
      "This invitation expires in {{expiresInHours}} hours.",
      "If you did not expect this email, you can ignore it.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">You are invited</h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, you have been invited to join {{appName}}.</p>
          <a href="{{invitationUrl}}" style="display: inline-block; margin-bottom: 20px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Accept Invitation</a>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #475569;">This invitation expires in {{expiresInHours}} hours.</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">If you did not expect this email, you can ignore it.</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: COURSE_ENROLLMENT_EMAIL_TEMPLATE_KEY,
    name: "Course Enrollment Confirmation",
    description: "Email confirming successful enrollment in a course.",
    subject: "Enrollment confirmed: {{courseName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "You have been successfully enrolled in the course: {{courseName}}.",
      "",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "Start Date: {{startDate}}",
      "",
      "Login to access your course materials: {{loginUrl}}",
      "If you have any questions, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Enrollment confirmed</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, you have been enrolled in <strong>{{courseName}}</strong>.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Start Date:</strong> {{startDate}}</p>
          </div>
          <a href="{{loginUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Go to Course</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: BUDDY_PERSONA_AVAILABLE_EMAIL_TEMPLATE_KEY,
    name: "Buddy Persona Available",
    description: "Email sent when a course-specific Buddy persona is ready for a learner.",
    subject: "Meet your Buddy for {{courseName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Your Buddy persona is now ready for {{courseName}}.",
      "",
      "Buddy: {{buddyPersonaName}}",
      "Conversation language: {{buddyLanguage}}",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "",
      "Sign in to start the conversation: {{loginUrl}}",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Your Buddy is ready</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your course Buddy for <strong>{{courseName}}</strong> is now available.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Buddy:</strong> {{buddyPersonaName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Conversation language:</strong> {{buddyLanguage}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
          </div>
          <a href="{{loginUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Open Buddy</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: BUDDY_EMAIL_ACTION_EMAIL_TEMPLATE_KEY,
    name: "Buddy Email Action",
    description: "Email sent to academy support or the assigned trainer after the learner confirms a Buddy-drafted email action.",
    subject: "Buddy message from {{senderName}}: {{emailSubject}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Buddy prepared a learner-approved email action for {{targetLabel}}.",
      "",
      "Buddy persona: {{buddyPersonaName}}",
      "Candidate: {{senderName}}",
      "Learner code: {{senderLearnerCode}}",
      "Candidate email: {{senderEmail}}",
      "Course: {{courseName}}",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "",
      "Requested subject:",
      "{{emailSubject}}",
      "",
      "Requested message:",
      "{{candidateMessage}}",
      "",
      "Candidate portal: {{portalUrl}}",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Buddy email action</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, Buddy prepared and the learner confirmed an email action for <strong>{{targetLabel}}</strong>.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Buddy persona:</strong> {{buddyPersonaName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Candidate:</strong> {{senderName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Learner code:</strong> {{senderLearnerCode}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Candidate email:</strong> {{senderEmail}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
          </div>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #1e3a8a;"><strong>Requested subject</strong></p>
            <p style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 700;">{{emailSubject}}</p>
          </div>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Requested message</strong></p>
            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-wrap;">{{candidateMessage}}</p>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Candidate portal: <a href="{{portalUrl}}" style="color: #0d3b84;">{{portalUrl}}</a></p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: COURSE_COMPLETION_EMAIL_TEMPLATE_KEY,
    name: "Course Completion",
    description: "Email sent when a learner completes a course.",
    subject: "Congratulations! You completed {{courseName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Congratulations! You have successfully completed the course: {{courseName}}.",
      "",
      "Completion Date: {{completionDate}}",
      "",
      "Keep up the great work!",
      "Login to view your achievements: {{loginUrl}}",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Course completed!</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, congratulations on completing <strong>{{courseName}}</strong>!</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; text-align: center;">
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #065f46;">Course Completed</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #047857;">{{completionDate}}</p>
          </div>
          <a href="{{loginUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">View Achievements</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Keep up the great work!</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: BATCH_EVENT_NOTIFICATION_EMAIL_TEMPLATE_KEY,
    name: "Batch Event Notification",
    description: "Email sent when a new batch event is scheduled for a learner.",
    subject: "New batch event: {{eventTitle}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "A new batch event has been scheduled for you.",
      "",
      "Event: {{eventTitle}}",
      "Type: {{eventType}}",
      "Course: {{courseName}}",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "Starts: {{startsAt}}",
      "Ends: {{endsAt}}",
      "Location: {{location}}",
      "Meeting link: {{meetingUrl}}",
      "",
      "Open your candidate portal: {{portalUrl}}",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">New batch event</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, a new batch event has been scheduled for you.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Event:</strong> {{eventTitle}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Type:</strong> {{eventType}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Starts:</strong> {{startsAt}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Ends:</strong> {{endsAt}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Location:</strong> {{location}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Meeting link:</strong> {{meetingUrl}}</p>
          </div>
          <a href="{{portalUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Open Candidate Portal</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: ASSESSMENT_SCHEDULED_EMAIL_TEMPLATE_KEY,
    name: "Assessment Scheduled",
    description: "Email sent when a new assessment is scheduled for a learner.",
    subject: "New assessment scheduled: {{assessmentTitle}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "A new assessment has been scheduled for your batch.",
      "",
      "Assessment: {{assessmentTitle}}",
      "Type: {{assessmentType}}",
      "Course: {{courseName}}",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "Scheduled for: {{scheduledAt}}",
      "Duration: {{timeLimit}}",
      "Meeting link: {{meetingUrl}}",
      "",
      "Open your candidate portal: {{portalUrl}}",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Assessment scheduled</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, a new assessment is now on your schedule.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Assessment:</strong> {{assessmentTitle}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Type:</strong> {{assessmentType}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Scheduled for:</strong> {{scheduledAt}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Duration:</strong> {{timeLimit}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Meeting link:</strong> {{meetingUrl}}</p>
          </div>
          <a href="{{portalUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Open Candidate Portal</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: ASSESSMENT_COMPLETED_EMAIL_TEMPLATE_KEY,
    name: "Assessment Completed",
    description: "Email sent after a candidate completes an assessment submission.",
    subject: "Assessment submitted: {{assessmentTitle}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "We have received your assessment submission.",
      "",
      "Assessment: {{assessmentTitle}}",
      "Course: {{courseName}}",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "Submitted at: {{submittedAt}}",
      "Next step: {{completionNote}}",
      "",
      "Open your candidate portal: {{portalUrl}}",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Assessment submitted</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your assessment submission has been recorded.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Assessment:</strong> {{assessmentTitle}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Submitted at:</strong> {{submittedAt}}</p>
          </div>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #334155;">{{completionNote}}</p>
          <a href="{{portalUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Open Candidate Portal</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: ASSESSMENT_RESULT_EMAIL_TEMPLATE_KEY,
    name: "Assessment Result",
    description: "Email sent when an assessment result is available for a candidate.",
    subject: "Assessment result: {{assessmentTitle}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Your assessment result is now available.",
      "",
      "Assessment: {{assessmentTitle}}",
      "Course: {{courseName}}",
      "Program: {{programName}}",
      "Batch: {{batchName}}",
      "Score: {{scoreSummary}}",
      "Status: {{resultStatus}}",
      "Reviewed by: {{reviewerName}}",
      "Reviewed at: {{gradedAt}}",
      "Reviewer feedback: {{reviewerFeedback}}",
      "",
      "Open your candidate portal: {{portalUrl}}",
      "If you need help, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Assessment result</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your assessment result is ready.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Assessment:</strong> {{assessmentTitle}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Score:</strong> {{scoreSummary}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Status:</strong> {{resultStatus}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Reviewed by:</strong> {{reviewerName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Reviewed at:</strong> {{gradedAt}}</p>
          </div>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #334155;">{{reviewerFeedback}}</p>
          <a href="{{portalUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Open Candidate Portal</a>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">Need help? Contact {{supportEmail}}</p>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: QUIZ_ASSIGNED_EMAIL_TEMPLATE_KEY,
    name: "Quiz Assigned",
    description: "Email sent when a quiz is assigned to a learner.",
    subject: "New quiz assigned: {{quizName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "A new quiz has been assigned to you: {{quizName}}",
      "",
      "Course: {{courseName}}",
      "Due Date: {{dueDate}}",
      "",
      "Login to start the quiz: {{loginUrl}}",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Quiz assigned</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, a new quiz has been assigned to you.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Quiz:</strong> {{quizName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Due Date:</strong> {{dueDate}}</p>
          </div>
          <a href="{{loginUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">Start Quiz</a>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: QUIZ_RESULT_EMAIL_TEMPLATE_KEY,
    name: "Quiz Result",
    description: "Email sent with quiz results after completion.",
    subject: "Your quiz results: {{quizName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "Your results for {{quizName}} are ready.",
      "",
      "Score: {{score}}",
      "Status: {{resultStatus}}",
      "",
      "Login to view details: {{loginUrl}}",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Quiz results</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, your results for <strong>{{quizName}}</strong> are ready.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: #0f172a;">{{score}}</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #475569;">{{resultStatus}}</p>
          </div>
          <a href="{{loginUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">View Details</a>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: TRAINER_ASSIGNMENT_EMAIL_TEMPLATE_KEY,
    name: "Trainer Assignment",
    description: "Email sent when a trainer is assigned to a batch or course.",
    subject: "New assignment: {{batchName}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "You have been assigned as a trainer for:",
      "",
      "Batch: {{batchName}}",
      "Course: {{courseName}}",
      "Program: {{programName}}",
      "",
      "Login to view your schedule: {{loginUrl}}",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">Trainer assignment</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}}, you have been assigned as a trainer.</p>
          <div style="margin: 0 0 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Batch:</strong> {{batchName}}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #475569;"><strong>Course:</strong> {{courseName}}</p>
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Program:</strong> {{programName}}</p>
          </div>
          <a href="{{loginUrl}}" style="display: inline-block; margin-bottom: 16px; padding: 12px 18px; background: #0d3b84; border-radius: 12px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">View Schedule</a>
        </div>
      </div>
    `,
    isSystem: true,
    isActive: true,
  },
  {
    key: GENERAL_NOTIFICATION_EMAIL_TEMPLATE_KEY,
    name: "General Notification",
    description: "General-purpose notification email template.",
    subject: "{{notificationSubject}}",
    textContent: [
      "Hello {{recipientName}},",
      "",
      "{{notificationBody}}",
      "",
      "If you have any questions, contact {{supportEmail}}.",
    ].join("\n"),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; background: #f6f7f9; padding: 32px; color: #0f172a;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #dde1e6; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">{{appName}}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2; color: #0d3b84;">{{notificationTitle}}</h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">Hello {{recipientName}},</p>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">{{notificationBody}}</p>
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