"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TemplateKeyField } from "@/components/modules/email-templates/template-key-field";
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

type EditEmailTemplateForm = {
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  isActive: boolean;
};

const emptyForm: EditEmailTemplateForm = {
  key: "",
  name: "",
  description: "",
  subject: "",
  htmlContent: "",
  textContent: "",
  isActive: true,
};

const textareaClassName = "min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]";

function extractVariables(...sources: string[]) {
  const matches = new Set<string>();

  for (const source of sources) {
    for (const match of source.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
  }

  return Array.from(matches).sort((left, right) => left.localeCompare(right));
}

type EditEmailTemplateSheetProps = {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTemplateKeys?: string[];
};

export function EditEmailTemplateSheet({ templateId, open, onOpenChange, existingTemplateKeys = [] }: EditEmailTemplateSheetProps) {
  const router = useRouter();
  const [form, setForm] = useState<EditEmailTemplateForm>(emptyForm);
  const [isSystem, setIsSystem] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "updated">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedVariables = useMemo(
    () => extractVariables(form.subject, form.htmlContent, form.textContent),
    [form.subject, form.htmlContent, form.textContent],
  );

  useEffect(() => {
    if (!open || !templateId) {
      return;
    }

    let active = true;

    const loadTemplate = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/email-templates/${templateId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load email template.");
        }

        const payload = (await response.json()) as { data?: EmailTemplateDetail };
        if (!active || !payload.data) {
          return;
        }

        setForm({
          key: payload.data.key,
          name: payload.data.name,
          description: payload.data.description ?? "",
          subject: payload.data.subject,
          htmlContent: payload.data.htmlContent,
          textContent: payload.data.textContent,
          isActive: payload.data.isActive,
        });
        setIsSystem(payload.data.isSystem);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load email template.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadTemplate();

    return () => {
      active = false;
    };
  }, [open, templateId]);

  const reset = () => {
    setForm(emptyForm);
    setIsSystem(false);
    setStep("form");
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.key.trim() || !form.name.trim() || !form.subject.trim() || !form.htmlContent.trim()) {
      setError("Please complete Key, Name, Subject, and HTML Body before continuing.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleUpdate = async () => {
    if (!templateId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/email-templates/${templateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update email template.");
      }

      setStep("updated");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update email template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Email Template</SheetTitle>
          <SheetDescription>Update the template content used by platform email flows.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden p-6" onSubmit={handleDone}>
            {isLoading ? (
              <SheetLoadingSkeleton isLoading={true} variant="form" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TemplateKeyField
                    value={form.key}
                    onChange={(nextKey) => setForm((prev) => ({ ...prev, key: nextKey }))}
                    unavailableKeys={existingTemplateKeys}
                    disabled={isSystem}
                    lockedMessage="System templates keep a fixed key so mail flows continue resolving correctly."
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Template Name</label>
                    <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
                  <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Subject</label>
                  <Input value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">HTML Body</label>
                  <textarea
                    className="min-h-56 w-full rounded-xl border border-[#dde1e6] px-3 py-2 font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                    value={form.htmlContent}
                    onChange={(event) => setForm((prev) => ({ ...prev, htmlContent: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Plain Text Fallback</label>
                  <textarea
                    className={textareaClassName}
                    value={form.textContent}
                    onChange={(event) => setForm((prev) => ({ ...prev, textContent: event.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="email-template-edit-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <label htmlFor="email-template-edit-active" className="text-sm text-slate-600">Template is active</label>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Detected Variables</p>
                  {detectedVariables.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detectedVariables.map((variable) => (
                        <span key={variable} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {variable}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No placeholder variables detected yet.</p>
                  )}
                </div>
              </>
            )}

            {!isLoading ? (
              <>
                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
                <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
                  <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Done</Button>
                </SheetFooter>
              </>
            ) : null}
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Click Update Template to save these changes.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Key:</span> {form.key.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Name:</span> {form.name.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Subject:</span> {form.subject.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Variables:</span> {detectedVariables.join(", ") || "None"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Status:</span> {form.isActive ? "ACTIVE" : "INACTIVE"}
              </p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Template"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "updated" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Template Updated</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been updated successfully.</p>
              </CardContent>
            </Card>
            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}