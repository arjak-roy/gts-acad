"use client";

import { Loader2, Upload } from "lucide-react";

import type { SettingDefinitionItem, SettingsAssetValue } from "@/services/settings/types";
import { Button } from "@/components/ui/button";

type SettingsFileUploadFieldProps = {
  setting: Pick<SettingDefinitionItem, "key" | "label">;
  asset: SettingsAssetValue | null;
  disabled: boolean;
  isUploading: boolean;
  onUpload: (file: File | null) => void;
  onRemove: () => void;
};

export function SettingsFileUploadField({ setting, asset, disabled, isUploading, onUpload, onRemove }: SettingsFileUploadFieldProps) {
  const isImageAsset = asset?.mimeType.startsWith("image/") ?? false;

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      {asset ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{asset.originalName}</p>
              <p className="text-xs text-slate-500">{asset.mimeType} · {Math.round(asset.size / 1024)} KB</p>
            </div>
            <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">
              Open asset
            </a>
          </div>
          {isImageAsset ? (
            <img src={asset.url} alt={setting.label} className="mt-3 max-h-32 rounded-xl border border-slate-100 object-contain" />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No asset uploaded for this setting yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-[#dde1e6] transition-colors hover:bg-slate-50">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload file
          <input
            className="hidden"
            type="file"
            disabled={disabled}
            onChange={(event) => {
              onUpload(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {asset ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
