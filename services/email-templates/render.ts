import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  getDefaultEmailTemplate,
  isMissingEmailTemplateTable,
  renderEmailTemplateSource,
  stripHtmlToText,
  TemplateVariables,
} from "@/services/email-templates/helpers";
import { ensureDefaultEmailTemplates } from "@/services/email-templates/defaults";
import { getBrandingRuntimeSettings, getGeneralRuntimeSettings } from "@/services/settings/runtime";

type RenderableEmailTemplateSource = Pick<
  Awaited<ReturnType<typeof getDefaultEmailTemplate>> extends infer T
    ? T extends { subject: string; htmlContent: string; textContent: string }
      ? T
      : never
    : never,
  "subject" | "htmlContent" | "textContent"
>;

function normalizeOrigin(origin: string | undefined | null) {
  const normalized = origin?.trim();
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/$/, "");
  }

  return `https://${normalized}`.replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAbsoluteBrandLogoUrl(applicationUrl: string | null) {
  const baseUrl =
    applicationUrl ??
    normalizeOrigin(process.env.INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(process.env.VERCEL_URL);

  if (!baseUrl) {
    return null;
  }

  return new URL("/api/branding/application-logo", `${baseUrl}/`).toString();
}

function buildEmailLogoMarkup(input: { logoUrl: string; companyName: string; applicationUrl: string | null }) {
  const imageMarkup = `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.companyName)}" style="max-width: 200px; max-height: 64px; width: auto; height: auto; display: inline-block; border: 0; outline: none; text-decoration: none;" />`;
  const content = input.applicationUrl
    ? `<a href="${escapeHtml(input.applicationUrl)}" style="display: inline-block; text-decoration: none;">${imageMarkup}</a>`
    : imageMarkup;

  return `<div style="max-width: 560px; margin: 0 auto 16px; text-align: center;">${content}</div>`;
}

function prependBrandLogo(html: string, logoMarkup: string, logoUrl: string) {
  if (!logoMarkup || !html.trim() || html.includes(logoUrl)) {
    return html;
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, (match) => `${match}${logoMarkup}`);
  }

  return `${logoMarkup}${html}`;
}

async function buildEmailBrandingVariables() {
  const [generalSettings, brandingSettings] = await Promise.all([
    getGeneralRuntimeSettings(),
    getBrandingRuntimeSettings(),
  ]);

  const applicationUrl = normalizeOrigin(generalSettings.applicationUrl);
  const companyName = brandingSettings.companyName.trim() || generalSettings.applicationName;
  const brandLogoUrl = buildAbsoluteBrandLogoUrl(applicationUrl);

  return {
    appName: generalSettings.applicationName,
    companyName,
    applicationUrl: applicationUrl ?? "",
    footerText: brandingSettings.footerText,
    brandPrimaryColor: brandingSettings.primaryThemeColor,
    brandSecondaryColor: brandingSettings.secondaryThemeColor,
    brandLogoUrl: brandLogoUrl ?? "",
    _brandLogoAbsoluteUrl: brandLogoUrl,
  };
}

export async function renderEmailTemplateSourceWithBrandingService(
  template: RenderableEmailTemplateSource,
  variables: TemplateVariables,
) {
  const brandingVariables = await buildEmailBrandingVariables();
  const mergedVariables: TemplateVariables = {
    ...brandingVariables,
    ...variables,
  };

  const rendered = renderEmailTemplateSource(template, mergedVariables);
  const logoUrl = brandingVariables._brandLogoAbsoluteUrl;

  if (!logoUrl) {
    return rendered;
  }

  return {
    ...rendered,
    html: prependBrandLogo(
      rendered.html,
      buildEmailLogoMarkup({
        logoUrl,
        companyName: String(mergedVariables.companyName ?? mergedVariables.appName ?? "Application"),
        applicationUrl: String(mergedVariables.applicationUrl ?? "").trim() || null,
      }),
      logoUrl,
    ),
  };
}

export async function renderEmailTemplateByKeyService(templateKey: string, variables: TemplateVariables) {
  const fallbackTemplate = getDefaultEmailTemplate(templateKey);

  if (isDatabaseConfigured) {
    try {
      await ensureDefaultEmailTemplates();

      const template = await prisma.emailTemplate.findUnique({
        where: { key: templateKey },
        select: {
          subject: true,
          htmlContent: true,
          textContent: true,
          isActive: true,
        },
      });

      if (template?.isActive) {
        return renderEmailTemplateSourceWithBrandingService(
          {
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent?.trim() || stripHtmlToText(template.htmlContent),
          },
          variables,
        );
      }
    } catch (error) {
      if (!isMissingEmailTemplateTable(error)) {
        console.warn(`Email template fallback activated for ${templateKey}.`, error);
      }
    }
  }

  if (!fallbackTemplate) {
    throw new Error("Email template not found.");
  }

  return renderEmailTemplateSourceWithBrandingService(fallbackTemplate, variables);
}
