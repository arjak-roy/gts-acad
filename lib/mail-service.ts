import "server-only";

import nodemailer from "nodemailer";

import { getEmailRuntimeSettings, getGeneralRuntimeSettings } from "@/services/settings/runtime";

type MailConfigurationInput = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  fromAddress?: string;
  fromName?: string;
  secure?: boolean;
};

type ResolvedMailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
};

let transporterCache:
  | {
      key: string;
      transporter: ReturnType<typeof nodemailer.createTransport>;
    }
  | null = null;

function buildTransportCacheKey(config: ResolvedMailConfiguration) {
  return JSON.stringify([
    config.host,
    config.port,
    config.secure,
    config.auth.user,
    config.auth.pass,
    config.from,
  ]);
}

async function resolveMailConfiguration(overrides: MailConfigurationInput = {}): Promise<ResolvedMailConfiguration> {
  const emailSettings = await getEmailRuntimeSettings();
  const generalSettings = await getGeneralRuntimeSettings();

  const host = overrides.host ?? emailSettings.smtpHost;
  const username = overrides.username ?? emailSettings.smtpUsername;
  const password = overrides.password ?? emailSettings.smtpPassword;
  const fromAddress = overrides.fromAddress ?? emailSettings.senderEmailAddress;
  const fromName = overrides.fromName ?? emailSettings.senderName ?? generalSettings.applicationName;
  const port = overrides.port ?? emailSettings.smtpPort;
  const secure = overrides.secure ?? emailSettings.enableSslTls;

  if (!host || !username || !password || !fromAddress || Number.isNaN(port)) {
    throw new Error("Mail service is not fully configured.");
  }

  return {
    host,
    port,
    secure: secure || port === 465,
    auth: {
      user: username,
      pass: password,
    },
    from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
  };
}

async function getTransporter(configuration?: ResolvedMailConfiguration) {
  const config = configuration ?? (await resolveMailConfiguration());
  const cacheKey = buildTransportCacheKey(config);

  if (transporterCache?.key === cacheKey) {
    return {
      config,
      transporter: transporterCache.transporter,
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  transporterCache = {
    key: cacheKey,
    transporter,
  };

  return {
    config,
    transporter,
  };
}

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function invalidateMailTransportCache() {
  transporterCache = null;
}

export async function sendMail({ to, subject, text, html }: SendMailInput, overrides?: MailConfigurationInput) {
  const resolvedConfiguration = overrides ? await resolveMailConfiguration(overrides) : undefined;
  const { transporter, config } = await getTransporter(resolvedConfiguration);

  return transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  });
}

export async function testMailConfiguration(configuration: MailConfigurationInput, message: SendMailInput) {
  const resolvedConfiguration = await resolveMailConfiguration(configuration);
  const transporter = nodemailer.createTransport({
    host: resolvedConfiguration.host,
    port: resolvedConfiguration.port,
    secure: resolvedConfiguration.secure,
    auth: resolvedConfiguration.auth,
  });

  await transporter.verify();

  return transporter.sendMail({
    from: resolvedConfiguration.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
