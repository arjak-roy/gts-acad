"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type EmailTemplateDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

const readonlyTextareaClassName = "min-h-40 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:outline-none";
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
  return source.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    return variables[key] ?? "";
  });
}

type EmailTemplateDetailSheetProps = {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (templateId: string) => void;
};

export function EmailTemplateDetailSheet({ templateId, open, onOpenChange, onEdit }: EmailTemplateDetailSheetProps) {
  const [template, setTemplate] = useState<EmailTemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewVariables = useMemo(() => buildPreviewVariables(template?.variables ?? []), [template?.variables]);
  const renderedPreview = useMemo(() => {
    if (!template) {
      return null;
    }

    return {
      subject: applyTemplateVariables(template.subject, previewVariables),
      html: applyTemplateVariables(template.htmlContent, previewVariables),
      text: applyTemplateVariables(template.textContent, previewVariables),
    };
  }, [template, previewVariables]);

  useEffect(() => {
    if (!open || !templateId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/email-templates/${templateId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load email template details.");
        }

        const payload = (await response.json()) as { data?: EmailTemplateDetail };
        if (active) {
          setTemplate(payload.data ?? null);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load email template details.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
          setTestError(null);
          setTestMessage(null);
        }
      });

    return () => {
      active = false;
    };
  }, [open, templateId]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTemplate(null);
      setTestMessage(null);
      setTestError(null);
      setTestRecipient("");
      setError(null);
    }
  };

  const handleSendTestEmail = async () => {
    if (!template || isSendingTest) {
      return;
    }

    setIsSendingTest(true);
    setTestMessage(null);
    setTestError(null);

    try {
      const response = await fetch(`/api/email-templates/${template.id}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipientEmail: testRecipient.trim() || undefined }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: { recipientEmail: string }; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Failed to send test email.");
      }

      setTestMessage(`Test email sent to ${payload.data.recipientEmail}.`);
      toast.success(`Test email sent to ${payload.data.recipientEmail}.`);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Failed to send test email.";
      setTestError(message);
      toast.error(message);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : template ? (
          <>
            <SheetHeader>
              <SheetTitle>{template.name}</SheetTitle>
              <SheetDescription>{template.description ?? "Reusable email template."}</SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={template.isActive ? "success" : "danger"}>{template.isActive ? "Active" : "Inactive"}</Badge>
                <Badge variant={template.isSystem ? "info" : "default"}>{template.isSystem ? "System" : "Custom"}</Badge>
                <Badge variant="accent">{template.variables.length} variables</Badge>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Template Key</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{template.key}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Subject</p>
                  <p className="mt-2 text-sm text-slate-700">{template.subject}</p>
                </div>
                {template.categoryName ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Category</p>
                    <p className="mt-2 text-sm text-slate-700">{template.categoryName}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Updated</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {new Date(template.updatedAt).toLocaleString("en-IN")}
                    {template.updatedByName ? ` by ${template.updatedByName}` : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Variables</p>
                {template.variables.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {template.variables.map((variable) => (
                      <span key={variable} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {variable}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">This template does not currently use any placeholder variables.</p>
                )}
              </div>

              <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">HTML Body</p>
                <textarea readOnly className={readonlyTextareaClassName} value={template.htmlContent} />
              </div>

              <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Plain Text Fallback</p>
                <textarea readOnly className={readonlyTextareaClassName} value={template.textContent} />
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Rendered Preview</p>
                <p className="text-xs text-slate-500">Preview uses deterministic sample values for detected placeholders.</p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Preview Subject</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{renderedPreview?.subject ?? template.subject}</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <p className="border-b border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Preview HTML</p>
                  <iframe title="Email HTML preview" className="h-72 w-full bg-white" srcDoc={renderedPreview?.html ?? template.htmlContent} />
                </div>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Preview Plain Text</p>
                  <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">{renderedPreview?.text ?? template.textContent}</pre>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Send Test Email</p>
                <p className="text-xs text-slate-500">Leave recipient empty to send to your signed-in account email.</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="email"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                    placeholder="admin@gts-academy.app"
                    value={testRecipient}
                    onChange={(event) => setTestRecipient(event.target.value)}
                  />
                  <CanAccess permission="email_templates.edit">
                    <Button type="button" onClick={handleSendTestEmail} disabled={isSendingTest}>
                      {isSendingTest ? "Sending..." : "Send Test"}
                    </Button>
                  </CanAccess>
                </div>
                {testMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{testMessage}</p> : null}
                {testError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{testError}</p> : null}
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="email_templates.edit">
                <Button onClick={() => onEdit(template.id)}>Edit Template</Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}