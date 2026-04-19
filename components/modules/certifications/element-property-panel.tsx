"use client";

import React, { type ChangeEvent, useRef, useState } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import type { CanvasElement } from "@/services/certifications/types";
import { DYNAMIC_VARIABLES } from "@/services/certifications/types";
import { Button } from "@/components/ui/button";
import type { BrandingUrls } from "./canvas-element-renderer";

const selectClassName =
  "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";
const inputClassName =
  "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";
const labelClassName = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

type Props = {
  element: CanvasElement;
  onChange: (updated: CanvasElement) => void;
  onDelete: () => void;
  templateId?: string;
  brandingUrls?: BrandingUrls;
};

export function ElementPropertyPanel({ element, onChange, onDelete, templateId, brandingUrls }: Props) {
  function patch(partial: Partial<CanvasElement>) {
    onChange({ ...element, ...partial } as CanvasElement);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 capitalize">{element.type.replace("-", " ")}</h3>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Position & Size */}
      <fieldset className="space-y-2">
        <legend className={labelClassName}>Position &amp; Size</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            X
            <input type="number" className={inputClassName} value={element.x} onChange={(e) => patch({ x: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            Y
            <input type="number" className={inputClassName} value={element.y} onChange={(e) => patch({ y: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            W
            <input type="number" className={inputClassName} value={element.width} onChange={(e) => patch({ width: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            H
            <input type="number" className={inputClassName} value={element.height} onChange={(e) => patch({ height: Number(e.target.value) })} />
          </label>
        </div>
        <label className="text-xs text-slate-500">
          Z-Index
          <input type="number" className={inputClassName} value={element.zIndex ?? 0} onChange={(e) => patch({ zIndex: Number(e.target.value) })} />
        </label>
      </fieldset>

      {/* Text-specific */}
      {(element.type === "text" || element.type === "dynamic-text") && (
        <fieldset className="space-y-2">
          <legend className={labelClassName}>Typography</legend>

          {element.type === "text" && (
            <label className="text-xs text-slate-500">
              Content
              <textarea
                className={inputClassName + " min-h-[60px] resize-y"}
                value={element.content}
                onChange={(e) => patch({ content: e.target.value } as Partial<CanvasElement>)}
              />
            </label>
          )}

          {element.type === "dynamic-text" && (
            <div className="space-y-1">
              <label className="text-xs text-slate-500">
                Template
                <textarea
                  className={inputClassName + " min-h-[60px] resize-y"}
                  value={element.template}
                  onChange={(e) => patch({ template: e.target.value } as Partial<CanvasElement>)}
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {DYNAMIC_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                      const tpl = (element as { template: string }).template;
                      patch({ template: tpl + `{{${v}}}` } as Partial<CanvasElement>);
                    }}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Font Size
              <input
                type="number"
                className={inputClassName}
                value={(element as { fontSize?: number }).fontSize ?? 16}
                onChange={(e) => patch({ fontSize: Number(e.target.value) } as Partial<CanvasElement>)}
              />
            </label>
            <label className="text-xs text-slate-500">
              Font Family
              <select
                className={selectClassName}
                value={(element as { fontFamily?: string }).fontFamily ?? "serif"}
                onChange={(e) => patch({ fontFamily: e.target.value } as Partial<CanvasElement>)}
              >
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-serif</option>
                <option value="monospace">Monospace</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-slate-500">
              Weight
              <select
                className={selectClassName}
                value={(element as { fontWeight?: string }).fontWeight ?? "normal"}
                onChange={(e) => patch({ fontWeight: e.target.value as "normal" | "bold" | "light" } as Partial<CanvasElement>)}
              >
                <option value="light">Light</option>
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Style
              <select
                className={selectClassName}
                value={(element as { fontStyle?: string }).fontStyle ?? "normal"}
                onChange={(e) => patch({ fontStyle: e.target.value as "normal" | "italic" } as Partial<CanvasElement>)}
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Align
              <select
                className={selectClassName}
                value={(element as { textAlign?: string }).textAlign ?? "left"}
                onChange={(e) => patch({ textAlign: e.target.value as "left" | "center" | "right" } as Partial<CanvasElement>)}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>

          <label className="text-xs text-slate-500">
            Color
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(element as { color?: string }).color ?? "#000000"}
                onChange={(e) => patch({ color: e.target.value } as Partial<CanvasElement>)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input
                type="text"
                className={inputClassName}
                value={(element as { color?: string }).color ?? "#000000"}
                onChange={(e) => patch({ color: e.target.value } as Partial<CanvasElement>)}
              />
            </div>
          </label>
        </fieldset>
      )}

      {/* Image-specific */}
      {element.type === "image" && (
        <ImagePropertySection
          element={element}
          patch={patch}
          templateId={templateId}
          brandingUrls={brandingUrls}
        />
      )}

      {/* Shape-specific */}
      {element.type === "shape" && (
        <fieldset className="space-y-2">
          <legend className={labelClassName}>Shape</legend>
          <label className="text-xs text-slate-500">
            Shape
            <select
              className={selectClassName}
              value={element.shape}
              onChange={(e) => patch({ shape: e.target.value } as Partial<CanvasElement>)}
            >
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="line">Line</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Fill Color
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={element.fillColor ?? "#ffffff"}
                onChange={(e) => patch({ fillColor: e.target.value } as Partial<CanvasElement>)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input type="text" className={inputClassName} value={element.fillColor ?? ""} onChange={(e) => patch({ fillColor: e.target.value } as Partial<CanvasElement>)} />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Stroke Color
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={element.strokeColor ?? "#000000"}
                onChange={(e) => patch({ strokeColor: e.target.value } as Partial<CanvasElement>)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input type="text" className={inputClassName} value={element.strokeColor ?? ""} onChange={(e) => patch({ strokeColor: e.target.value } as Partial<CanvasElement>)} />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Stroke Width
            <input type="number" className={inputClassName} value={element.strokeWidth ?? 1} onChange={(e) => patch({ strokeWidth: Number(e.target.value) } as Partial<CanvasElement>)} />
          </label>
        </fieldset>
      )}

      {/* Border-specific */}
      {element.type === "border" && (
        <fieldset className="space-y-2">
          <legend className={labelClassName}>Border</legend>
          <label className="text-xs text-slate-500">
            Border Color
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={element.borderColor ?? "#000000"}
                onChange={(e) => patch({ borderColor: e.target.value } as Partial<CanvasElement>)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input type="text" className={inputClassName} value={element.borderColor ?? ""} onChange={(e) => patch({ borderColor: e.target.value } as Partial<CanvasElement>)} />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Border Width
            <input type="number" className={inputClassName} value={element.borderWidth ?? 2} onChange={(e) => patch({ borderWidth: Number(e.target.value) } as Partial<CanvasElement>)} />
          </label>
          <label className="text-xs text-slate-500">
            Style
            <select
              className={selectClassName}
              value={element.borderStyle ?? "solid"}
              onChange={(e) => patch({ borderStyle: e.target.value as "solid" | "double" | "dashed" } as Partial<CanvasElement>)}
            >
              <option value="solid">Solid</option>
              <option value="double">Double</option>
              <option value="dashed">Dashed</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Border Radius
            <input type="number" className={inputClassName} value={element.borderRadius ?? 0} onChange={(e) => patch({ borderRadius: Number(e.target.value) } as Partial<CanvasElement>)} />
          </label>
        </fieldset>
      )}

      {/* QR Code-specific */}
      {element.type === "qr-code" && (
        <fieldset className="space-y-2">
          <legend className={labelClassName}>QR Code</legend>
          <label className="text-xs text-slate-500">
            Foreground
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={element.foregroundColor ?? "#000000"}
                onChange={(e) => patch({ foregroundColor: e.target.value } as Partial<CanvasElement>)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input type="text" className={inputClassName} value={element.foregroundColor ?? "#000000"} onChange={(e) => patch({ foregroundColor: e.target.value } as Partial<CanvasElement>)} />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Background
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={element.backgroundColor ?? "#ffffff"}
                onChange={(e) => patch({ backgroundColor: e.target.value } as Partial<CanvasElement>)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-200"
              />
              <input type="text" className={inputClassName} value={element.backgroundColor ?? "#ffffff"} onChange={(e) => patch({ backgroundColor: e.target.value } as Partial<CanvasElement>)} />
            </div>
          </label>
        </fieldset>
      )}
    </div>
  );
}

// ── Image property section with upload ───────────────────────────────────────

function ImagePropertySection({
  element,
  patch,
  templateId,
  brandingUrls,
}: {
  element: CanvasElement & { type: "image" };
  patch: (partial: Partial<CanvasElement>) => void;
  templateId?: string;
  brandingUrls?: BrandingUrls;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve preview URL: explicit url > branding source url
  const resolvedUrl = element.url
    || (brandingUrls && element.source === "logo" ? brandingUrls.logo : null)
    || (brandingUrls && element.source === "signature1" ? brandingUrls.signature1 : null)
    || (brandingUrls && element.source === "signature2" ? brandingUrls.signature2 : null)
    || (brandingUrls && element.source === "background" ? brandingUrls.background : null)
    || null;

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !templateId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/certifications/templates/${templateId}/branding/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? "Upload failed.");
      }
      const result = (await res.json()) as { data?: { asset?: { url?: string } } };
      const url = result.data?.asset?.url;
      if (url) {
        patch({ url, source: "custom" } as Partial<CanvasElement>);
        toast.success("Image uploaded.");
      } else {
        throw new Error("Upload returned no URL.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className={labelClassName}>Image</legend>

      <label className="text-xs text-slate-500">
        Source Type
        <select
          className={selectClassName}
          value={element.source}
          onChange={(e) => patch({ source: e.target.value, url: undefined } as unknown as Partial<CanvasElement>)}
        >
          <option value="logo">Logo (from Branding)</option>
          <option value="signature1">Signature 1 (from Branding)</option>
          <option value="signature2">Signature 2 (from Branding)</option>
          <option value="background">Background (from Branding)</option>
          <option value="custom">Custom Image</option>
        </select>
      </label>

      {/* Preview */}
      {resolvedUrl && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedUrl}
            alt={element.source}
            className="mx-auto max-h-20 max-w-full rounded object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Upload */}
      {templateId && (
        <div className="space-y-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-[#0d3b84] hover:text-[#0d3b84]"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            {isUploading ? "Uploading…" : "Upload Image"}
          </button>
          {element.source !== "custom" && !element.url && (
            <p className="text-[10px] text-slate-400">
              Using {element.source} from Branding. Upload to override with a custom image.
            </p>
          )}
        </div>
      )}

      {/* URL input */}
      <label className="text-xs text-slate-500">
        Image URL
        <input
          type="text"
          className={inputClassName}
          value={element.url ?? ""}
          onChange={(e) => patch({ url: e.target.value || undefined } as Partial<CanvasElement>)}
          placeholder={element.source === "custom" ? "https://… or upload above" : "Override URL (optional)"}
        />
      </label>

      <label className="text-xs text-slate-500">
        Object Fit
        <select
          className={selectClassName}
          value={element.objectFit ?? "contain"}
          onChange={(e) => patch({ objectFit: e.target.value as "contain" | "cover" | "fill" } as Partial<CanvasElement>)}
        >
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
          <option value="fill">Fill</option>
        </select>
      </label>

      <label className="text-xs text-slate-500">
        Opacity
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={element.opacity ?? 1}
          onChange={(e) => patch({ opacity: Number(e.target.value) } as Partial<CanvasElement>)}
          className="w-full"
        />
      </label>
    </fieldset>
  );
}
