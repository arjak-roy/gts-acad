"use client";

import { Input } from "@/components/ui/input";
import {
  CUSTOM_EMAIL_TEMPLATE_KEY_VALUE,
  EMAIL_TEMPLATE_KEY_OPTIONS,
  getEmailTemplateKeyOption,
} from "@/lib/mail-templates/email-template-keys";

type TemplateKeyFieldProps = {
  value: string;
  onChange: (value: string) => void;
  unavailableKeys?: string[];
  disabled?: boolean;
  lockedMessage?: string;
  customPlaceholder?: string;
  customHelperText?: string;
};

export function TemplateKeyField({
  value,
  onChange,
  unavailableKeys = [],
  disabled = false,
  lockedMessage,
  customPlaceholder = "candidate-post-placement-followup",
  customHelperText = "Use a stable slug-like key. It will be normalized on save.",
}: TemplateKeyFieldProps) {
  const selectedOption = getEmailTemplateKeyOption(value);
  const selectValue = selectedOption ? selectedOption.key : CUSTOM_EMAIL_TEMPLATE_KEY_VALUE;
  const unavailableKeySet = new Set(unavailableKeys);
  const unavailableReservedCount = EMAIL_TEMPLATE_KEY_OPTIONS.filter((option) => unavailableKeySet.has(option.key) && option.key !== value).length;

  const helperText = disabled && lockedMessage
    ? lockedMessage
    : selectedOption?.description
      ?? (unavailableReservedCount > 0
        ? `${customHelperText} Reserved system keys already in use are disabled below.`
        : customHelperText);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Template Key</label>
      <select
        className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
        value={selectValue}
        onChange={(event) => onChange(event.target.value === CUSTOM_EMAIL_TEMPLATE_KEY_VALUE ? "" : event.target.value)}
        disabled={disabled}
      >
        <option value={CUSTOM_EMAIL_TEMPLATE_KEY_VALUE}>Custom key</option>
        {EMAIL_TEMPLATE_KEY_OPTIONS.map((option) => (
          <option key={option.key} value={option.key} disabled={unavailableKeySet.has(option.key) && option.key !== value}>
            {option.label}
          </option>
        ))}
      </select>

      {selectValue === CUSTOM_EMAIL_TEMPLATE_KEY_VALUE ? (
        <Input
          value={value}
          placeholder={customPlaceholder}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      ) : null}

      <p className="text-xs text-slate-500">{helperText}</p>
    </div>
  );
}