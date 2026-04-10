"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmailTemplatePreviewPanel } from "@/components/modules/email-templates/email-template-preview-panel";
import { TipTapEmailEditor } from "@/components/ui/tiptap-email-editor";
import { TemplateKeyField } from "@/components/modules/email-templates/template-key-field";
import { FloatingVariablePanel } from "@/components/modules/email-templates/floating-variable-panel";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getEmailTemplateKeyOption } from "@/lib/mail-templates/email-template-keys";

type CategoryOption = {
  id: string;
  name: string;
  code: string;
};

type AddEmailTemplateForm = {
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  isActive: boolean;
  categoryId: string;
};

const initialForm: AddEmailTemplateForm = {
  key: "",
  name: "",
  description: "",
  subject: "",
  htmlContent: "",
  textContent: "",
  isActive: true,
  categoryId: "",
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

type AddEmailTemplateSheetProps = {
  existingTemplateKeys?: string[];
};

export function AddEmailTemplateSheet({ existingTemplateKeys = [] }: AddEmailTemplateSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [form, setForm] = useState<AddEmailTemplateForm>(initialForm);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariablePanel, setShowVariablePanel] = useState(false);

  const detectedVariables = useMemo(
    () => extractVariables(form.subject, form.htmlContent, form.textContent),
    [form.subject, form.htmlContent, form.textContent],
  );

  useEffect(() => {
    if (!open) return;
    fetch("/api/email-template-categories")
      .then((res) => res.json())
      .then((payload: { data?: CategoryOption[] }) => {
        if (payload.data) setCategories(payload.data);
      })
      .catch(() => {});
  }, [open]);

  const resetFlow = () => {
    setForm(initialForm);
    setStep("form");
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
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

  const handleTemplateKeyChange = (nextKey: string) => {
    setForm((previous) => {
      const previousOption = getEmailTemplateKeyOption(previous.key);
      const nextOption = getEmailTemplateKeyOption(nextKey);
      const shouldReplaceName = !previous.name.trim() || (previousOption ? previous.name.trim() === previousOption.label : false);
      const shouldReplaceDescription = !previous.description.trim() || (previousOption ? previous.description.trim() === previousOption.description : false);

      return {
        ...previous,
        key: nextKey,
        name: shouldReplaceName ? (nextOption?.label ?? "") : previous.name,
        description: shouldReplaceDescription ? (nextOption?.description ?? "") : previous.description,
      };
    });
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          categoryId: form.categoryId || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create email template.");
      }

      setStep("created");
      router.refresh();
      toast.success("Email template created successfully.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create email template.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button>Create Template</Button>
      </SheetTrigger>
      <SheetContent className="overflow-hidden sm:max-w-[1120px]">
        <SheetHeader>
          <SheetTitle>Create Email Template</SheetTitle>
          <SheetDescription>Create a reusable HTML email template stored in the database.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden p-6" onSubmit={handleDone}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TemplateKeyField value={form.key} onChange={handleTemplateKeyChange} unavailableKeys={existingTemplateKeys} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Template Name</label>
                    <Input value={form.name} placeholder="Two-Factor Verification Code" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
                  <Input
                    value={form.description}
                    placeholder="What flow this template is used for"
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                  <select
                    className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                    value={form.categoryId}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Subject</label>
                  <Input
                    value={form.subject}
                    placeholder="{{appName}} verification code"
                    onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">HTML Body</label>
                  <TipTapEmailEditor
                    key={open ? "add-email-template-editor-open" : "add-email-template-editor-closed"}
                    value={form.htmlContent}
                    onChange={(value) => setForm((prev) => ({ ...prev, htmlContent: value }))}
                    placeholder="Start writing your email template..."
                    placeholderVariables={detectedVariables}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Plain Text Fallback</label>
                  <textarea
                    className={textareaClassName}
                    placeholder="Optional. If left blank, plain text will be generated from the HTML body."
                    value={form.textContent}
                    onChange={(event) => setForm((prev) => ({ ...prev, textContent: event.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="email-template-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <label htmlFor="email-template-active" className="text-sm text-slate-600">Template is active</label>
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
              </div>

              <EmailTemplatePreviewPanel
                className="xl:sticky xl:top-0 xl:self-start"
                subject={form.subject}
                htmlContent={form.htmlContent}
                textContent={form.textContent}
                variables={detectedVariables}
              />
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowVariablePanel(!showVariablePanel)}>
                {showVariablePanel ? "Hide Variables" : "Variables"}
              </Button>
              <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Done</Button>
            </SheetFooter>
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Click Create Template to save this email template.</p>
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
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Template"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Template Created</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been saved successfully.</p>
              </CardContent>
            </Card>
            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
        <FloatingVariablePanel open={showVariablePanel} onClose={() => setShowVariablePanel(false)} />
      </SheetContent>
    </Sheet>
  );
}