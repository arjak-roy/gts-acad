"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

const previewDefaults: Record<string, string> = {
  appName: "GTS Academy",
  recipientName: "Template Tester",
  recipientEmail: "admin@gts-academy.app",
  supportEmail: "support@gts-academy.app",
  loginUrl: "https://gts-acad.vercel.app",
  code: "123456",
  expiresInMinutes: "10",
  purposeLabel: "verify your account",
  learnerCode: "L-TEST-001",
  programName: "Demo Medical German Program",
  temporaryPassword: "TempPass#123",
};

function buildPreviewVariables(variables: string[]) {
  const map: Record<string, string> = {};

  for (const variable of variables) {
    map[variable] = previewDefaults[variable] ?? `sample_${variable}`;
  }

  return map;
}

function applyTemplateVariables(source: string, variables: Record<string, string>) {
  return source.replace(PLACEHOLDER_PATTERN, (_match, key: string) => variables[key] ?? "");
}

type EmailTemplatePreviewPanelProps = {
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  className?: string;
};

export function EmailTemplatePreviewPanel({
  subject,
  htmlContent,
  textContent,
  variables,
  className,
}: EmailTemplatePreviewPanelProps) {
  const previewVariables = useMemo(() => buildPreviewVariables(variables), [variables]);
  const renderedPreview = useMemo(
    () => ({
      subject: applyTemplateVariables(subject, previewVariables),
      html: applyTemplateVariables(htmlContent, previewVariables),
      text: applyTemplateVariables(textContent, previewVariables),
    }),
    [htmlContent, previewVariables, subject, textContent],
  );
  const previewVariableEntries = useMemo(() => Object.entries(previewVariables), [previewVariables]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Live Preview</p>
          <p className="mt-2 text-sm text-slate-500">Updates as you edit. Placeholder values use deterministic sample data.</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Sample Variables</p>
          {previewVariableEntries.length > 0 ? (
            <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {previewVariableEntries.map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{key}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={value}>{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No placeholders detected yet. Subject and body preview still update live.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Preview Subject</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {renderedPreview.subject.trim() || "Subject preview will appear here as you type."}
          </p>
        </div>

        {renderedPreview.html.trim() ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <p className="border-b border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Preview HTML</p>
            <iframe
              title="Email HTML live preview"
              className="h-80 w-full bg-white"
              sandbox=""
              srcDoc={renderedPreview.html}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
            Start writing the HTML body to render the email preview here.
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Preview Plain Text</p>
          {renderedPreview.text.trim() ? (
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">{renderedPreview.text}</pre>
          ) : (
            <p className="text-sm text-slate-500">
              Plain text fallback will be generated from the HTML body on save unless you provide custom fallback text.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}