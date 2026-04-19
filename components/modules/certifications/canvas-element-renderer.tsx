"use client";

import React from "react";
import QRCode from "qrcode";
import type { CanvasElement, DynamicVariableKey } from "@/services/certifications/types";
import { DYNAMIC_VARIABLES } from "@/services/certifications/types";

// ── Preview values for dynamic variables ─────────────────────────────────────

const PREVIEW_VALUES: Record<DynamicVariableKey, string> = {
  learnerName: "Jane Doe",
  courseName: "Business English",
  programName: "GTS Academy 2026",
  batchName: "Batch A",
  issuedDate: "2026-04-18",
  expiryDate: "2027-04-18",
  certificateNumber: "GTS-CERT-2026-00001",
  verificationCode: "abc123def456",
  verificationUrl: "https://academy.gts.ai/verify/abc123def456",
};

type DynamicValues = Partial<Record<DynamicVariableKey, string | null | undefined>>;

function resolveDynamicTemplate(template: string, dynamicValues?: DynamicValues): string {
  let result = template;
  const mergedValues = { ...PREVIEW_VALUES, ...dynamicValues };
  for (const key of DYNAMIC_VARIABLES) {
    result = result.replaceAll(`{{${key}}}`, String(mergedValues[key] ?? ""));
  }
  return result;
}

function QrCodeElementView({
  payload,
  foregroundColor,
  backgroundColor,
}: {
  payload: string;
  foregroundColor: string;
  backgroundColor: string;
}) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(payload, {
      margin: 0,
      errorCorrectionLevel: "M",
      width: 512,
      color: {
        dark: foregroundColor,
        light: backgroundColor,
      },
    })
      .then((url: string) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [payload, foregroundColor, backgroundColor]);

  if (!dataUrl) {
    return <div className="h-full w-full bg-slate-200" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="Verification QR code" style={{ width: "100%", height: "100%" }} />
  );
}

// ── Branding URL map ─────────────────────────────────────────────────────────

export type BrandingUrls = {
  logo: string | null;
  signature1: string | null;
  signature2: string | null;
  background: string | null;
};

function resolveImageUrl(element: { source: string; url?: string }, brandingUrls?: BrandingUrls): string | null {
  if (element.url) return element.url;
  if (!brandingUrls) return null;
  switch (element.source) {
    case "logo": return brandingUrls.logo;
    case "signature1": return brandingUrls.signature1;
    case "signature2": return brandingUrls.signature2;
    case "background": return brandingUrls.background;
    default: return null;
  }
}

// ── Individual element renderers ─────────────────────────────────────────────

export function CanvasElementRenderer({
  element,
  isSelected,
  onClick,
  brandingUrls,
  dynamicValues,
}: {
  element: CanvasElement;
  isSelected: boolean;
  onClick: () => void;
  brandingUrls?: BrandingUrls;
  dynamicValues?: DynamicValues;
}) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    outline: isSelected ? "2px solid #0d3b84" : "1px solid transparent",
    outlineOffset: 1,
    borderRadius: 2,
    cursor: "move",
  };

  switch (element.type) {
    case "text":
      return (
        <div
          style={{
            ...baseStyle,
            fontSize: element.fontSize ?? 16,
            fontFamily: element.fontFamily ?? "serif",
            fontWeight: element.fontWeight ?? "normal",
            fontStyle: element.fontStyle ?? "normal",
            color: element.color ?? "#000",
            textAlign: element.textAlign ?? "left",
            letterSpacing: element.letterSpacing,
            lineHeight: element.lineHeight ? `${element.lineHeight}` : undefined,
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
          onClick={onClick}
        >
          {element.content}
        </div>
      );

    case "dynamic-text":
      return (
        <div
          style={{
            ...baseStyle,
            fontSize: element.fontSize ?? 16,
            fontFamily: element.fontFamily ?? "serif",
            fontWeight: element.fontWeight ?? "normal",
            fontStyle: element.fontStyle ?? "normal",
            color: element.color ?? "#0d3b84",
            textAlign: element.textAlign ?? "left",
            letterSpacing: element.letterSpacing,
            lineHeight: element.lineHeight ? `${element.lineHeight}` : undefined,
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
          onClick={onClick}
        >
          {resolveDynamicTemplate(element.template, dynamicValues)}
        </div>
      );

    case "image": {
      const resolvedUrl = resolveImageUrl(element, brandingUrls);
      return (
        <div style={{ ...baseStyle, position: "relative" }} onClick={onClick}>
          {resolvedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt={element.source}
              style={{
                width: "100%",
                height: "100%",
                objectFit: element.objectFit ?? "contain",
                opacity: element.opacity ?? 1,
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-slate-100 text-xs text-slate-400 gap-0.5">
              <span className="capitalize">{element.source}</span>
              <span className="text-[10px]">{element.source === "custom" ? "Set URL or upload" : "Set in Branding"}</span>
            </div>
          )}
        </div>
      );
    }

    case "qr-code":
      {
        const qrPayload = resolveDynamicTemplate("{{verificationUrl}}", dynamicValues);
      return (
        <div
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: element.backgroundColor ?? "#fff",
            padding: 4,
          }}
          onClick={onClick}
        >
          <QrCodeElementView
            payload={qrPayload || PREVIEW_VALUES.verificationUrl}
            foregroundColor={element.foregroundColor ?? "#000000"}
            backgroundColor={element.backgroundColor ?? "#ffffff"}
          />
        </div>
      );
      }

    case "shape":
      return (
        <div
          style={{
            ...baseStyle,
            backgroundColor: element.shape === "line" ? "transparent" : (element.fillColor ?? "transparent"),
            border: element.strokeColor ? `${element.strokeWidth ?? 1}px solid ${element.strokeColor}` : undefined,
            borderRadius:
              element.shape === "circle" ? "50%" : (element.borderRadius ?? 0),
            opacity: element.opacity ?? 1,
            ...(element.shape === "line"
              ? {
                  borderTop: `${element.strokeWidth ?? 2}px solid ${element.strokeColor ?? "#000"}`,
                  display: "flex",
                  alignItems: "center",
                }
              : {}),
          }}
          onClick={onClick}
        />
      );

    case "border":
      return (
        <div
          style={{
            ...baseStyle,
            border: `${element.borderWidth ?? 2}px ${element.borderStyle ?? "solid"} ${element.borderColor ?? "#000"}`,
            borderRadius: element.borderRadius ?? 0,
          }}
          onClick={onClick}
        />
      );

    default:
      return null;
  }
}
