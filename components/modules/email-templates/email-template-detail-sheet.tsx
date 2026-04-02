"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  createdAt: string;
  updatedAt: string;
};

const readonlyTextareaClassName = "min-h-40 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:outline-none";

type EmailTemplateDetailSheetProps = {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (templateId: string) => void;
};

export function EmailTemplateDetailSheet({ templateId, open, onOpenChange, onEdit }: EmailTemplateDetailSheetProps) {
  const [template, setTemplate] = useState<EmailTemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
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
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Updated</p>
                  <p className="mt-2 text-sm text-slate-700">{new Date(template.updatedAt).toLocaleString("en-IN")}</p>
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
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => onEdit(template.id)}>Edit Template</Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}