import "server-only";

import nodemailer from "nodemailer";

let transporterPromise: ReturnType<typeof nodemailer.createTransport> | null = null;

function getMailConfig() {
  const host = process.env.MAIL_HOST;
  const username = process.env.MAIL_USERNAME;
  const password = process.env.MAIL_PASSWORD;
  const fromAddress = process.env.MAIL_FROM_ADDRESS;
  const fromName = process.env.MAIL_FROM_NAME || process.env.APP_NAME || "GTS Academy App";
  const port = Number.parseInt(process.env.MAIL_PORT ?? "587", 10);
  const encryption = (process.env.MAIL_ENCRYPTION ?? "null").toLowerCase();

  if (!host || !username || !password || !fromAddress || Number.isNaN(port)) {
    throw new Error("Mail service is not fully configured.");
  }

  return {
    host,
    port,
    secure: encryption === "ssl" || encryption === "tls" || port === 465,
    auth: {
      user: username,
      pass: password,
    },
    from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
  };
}

function getTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  const config = getMailConfig();
  transporterPromise = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return transporterPromise;
}

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendMail({ to, subject, text, html }: SendMailInput) {
  const transporter = getTransporter();
  const config = getMailConfig();

  return transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  });
}
