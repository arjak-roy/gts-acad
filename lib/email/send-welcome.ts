import "server-only";

import nodemailer from "nodemailer";

import { detectRoleFromEmail } from "@/lib/auth/detect-role-from-email";
import { html as adminHtml, subject as adminSubject } from "@/lib/email/templates/admin-welcome";
import { html as superAdminHtml, subject as superAdminSubject } from "@/lib/email/templates/superadmin-welcome";

type SendWelcomeEmailInput = {
  email: string;
  name?: string;
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || Number.isNaN(port)) {
    throw new Error("SMTP configuration is incomplete.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendWelcomeEmail({ email, name }: SendWelcomeEmailInput) {
  const role = detectRoleFromEmail(email);

  if (role === "trainer") {
    return { skipped: true as const };
  }

  const transporter = getTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@gts-academy.local";
  const selectedTemplate = role === "superadmin"
    ? { subject: superAdminSubject, html: superAdminHtml }
    : { subject: adminSubject, html: adminHtml };

  const personalizedHtml = selectedTemplate.html.replace(/Your account/g, `${name?.trim() || "Your account"}`);

  await transporter.sendMail({
    from,
    to: email,
    subject: selectedTemplate.subject,
    html: personalizedHtml,
  });

  return { skipped: false as const, role };
}