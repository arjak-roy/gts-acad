-- Email Template Variable Registry
-- Stores documented variable definitions for the template system.

CREATE TABLE "email_template_variables" (
    "variable_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(80) NOT NULL,
    "sample_value" VARCHAR(500),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_template_variables_pkey" PRIMARY KEY ("variable_id")
);

CREATE UNIQUE INDEX "email_template_variables_name_key" ON "email_template_variables"("name");
CREATE INDEX "idx_email_template_variables_category" ON "email_template_variables"("category");

-- Seed system variables
INSERT INTO "email_template_variables" ("name", "label", "description", "category", "sample_value", "is_system") VALUES
  ('appName', 'Application Name', 'Name of the application, injected from branding settings.', 'Branding', 'GTS Academy', true),
  ('companyName', 'Company Name', 'Company or organization name from branding settings.', 'Branding', 'GTS Academy', true),
  ('applicationUrl', 'Application URL', 'Base URL of the application from general settings.', 'Branding', 'https://gts-academy.app', true),
  ('footerText', 'Footer Text', 'Footer text injected into email layouts from branding settings.', 'Branding', '© 2026 GTS Academy. All rights reserved.', true),
  ('brandPrimaryColor', 'Primary Color', 'Primary brand theme color hex code.', 'Branding', '#0d3b84', true),
  ('brandSecondaryColor', 'Secondary Color', 'Secondary brand theme color hex code.', 'Branding', '#1e40af', true),
  ('brandLogoUrl', 'Logo URL', 'Absolute URL to the application logo image.', 'Branding', 'https://gts-academy.app/api/branding/application-logo', true),
  ('recipientName', 'Recipient Name', 'Full name of the email recipient.', 'Recipient', 'John Doe', true),
  ('recipientEmail', 'Recipient Email', 'Email address of the recipient.', 'Recipient', 'john@example.com', true),
  ('supportEmail', 'Support Email', 'Support contact email address.', 'General', 'support@gts-academy.app', true),
  ('loginUrl', 'Login URL', 'URL to the application login page.', 'General', 'https://gts-academy.app/login', true),
  ('currentYear', 'Current Year', 'The current calendar year for copyright notices.', 'General', '2026', true),
  ('templateName', 'Template Name', 'Name of the email template being rendered.', 'General', 'Two-Factor Verification Code', true),
  ('code', 'Verification Code', '6-digit OTP verification code for 2FA flows.', 'Authentication', '123456', true),
  ('expiresInMinutes', 'Expiry (Minutes)', 'Number of minutes until a code or token expires.', 'Authentication', '10', true),
  ('expiresInHours', 'Expiry (Hours)', 'Number of hours until a code or token expires.', 'Authentication', '24', true),
  ('purposeLabel', 'Purpose Label', 'Human-readable description of the verification purpose.', 'Authentication', 'verify your account', true),
  ('resetUrl', 'Reset URL', 'Full URL for the password reset page with token.', 'Authentication', 'https://gts-academy.app/reset-password?token=...', true),
  ('resetToken', 'Reset Token', 'The raw password reset token value.', 'Authentication', 'SAMPLE_RESET_TOKEN', true),
  ('invitationUrl', 'Invitation URL', 'Full URL for account activation or invitation link.', 'Authentication', 'https://gts-academy.app/activate-account?token=...', true),
  ('temporaryPassword', 'Temporary Password', 'Auto-generated temporary password for new accounts.', 'User Management', 'TempPass#123', true),
  ('learnerCode', 'Learner Code', 'Unique learner identification code for candidates.', 'User Management', 'L-TEST-001', true),
  ('primaryRole', 'Primary Role', 'The primary assigned role of the user.', 'User Management', 'Academy Admin', true),
  ('roleSummary', 'Role Summary', 'Comma-separated list of all assigned roles.', 'User Management', 'Academy Admin, Content Manager', true),
  ('programName', 'Program Name', 'Name of the training program.', 'Course & Program', 'Demo Medical German Program', true),
  ('courseName', 'Course Name', 'Name of the course.', 'Course & Program', 'React Fundamentals', true),
  ('batchName', 'Batch Name', 'Name or code of the batch.', 'Course & Program', 'Batch A - 2026', true),
  ('startDate', 'Start Date', 'Start date of a course, batch, or event.', 'Course & Program', '09/04/2026', true),
  ('completionDate', 'Completion Date', 'Completion date of a course or program.', 'Course & Program', '09/04/2026', true),
  ('quizName', 'Quiz Name', 'Name of the assigned quiz or assessment.', 'Assessment', 'Module 1 Assessment', true),
  ('dueDate', 'Due Date', 'Due date for an assessment or assignment.', 'Assessment', '16/04/2026', true),
  ('score', 'Score', 'Assessment score or grade.', 'Assessment', '85%', true),
  ('resultStatus', 'Result Status', 'Pass/fail status of an assessment.', 'Assessment', 'Passed', true),
  ('notificationSubject', 'Notification Subject', 'Subject line for general notification emails.', 'Notification', 'Important Update', true),
  ('notificationTitle', 'Notification Title', 'Title heading for general notification emails.', 'Notification', 'Platform Update', true),
  ('notificationBody', 'Notification Body', 'Main body content for general notification emails.', 'Notification', 'This is a sample notification message.', true);
