"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import type { CanvasElement } from "@/services/certifications/types";
import type { CertificateRenderedData } from "@/services/certifications/types";
import { CanvasElementRenderer } from "./canvas-element-renderer";
import type { BrandingUrls } from "./canvas-element-renderer";
import { getPaperSize } from "./paper-utils";

// ── Props ────────────────────────────────────────────────────────────────────

type CertificatePreviewRendererProps = {
  layoutJson: CanvasElement[];
  orientation: string;
  paperSize: string;
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
  signatory1SignatureUrl?: string | null;
  signatory2SignatureUrl?: string | null;
  renderedData?: CertificateRenderedData | null;
  className?: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CertificatePreviewRenderer({
  layoutJson,
  orientation,
  paperSize,
  backgroundColor,
  backgroundImageUrl,
  logoUrl,
  signatory1SignatureUrl,
  signatory2SignatureUrl,
  renderedData,
  className,
}: CertificatePreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const paper = useMemo(() => getPaperSize(paperSize, orientation), [paperSize, orientation]);

  const brandingUrls = useMemo<BrandingUrls>(
    () => ({
      logo: logoUrl ?? null,
      signature1: signatory1SignatureUrl ?? null,
      signature2: signatory2SignatureUrl ?? null,
      background: backgroundImageUrl ?? null,
    }),
    [logoUrl, signatory1SignatureUrl, signatory2SignatureUrl, backgroundImageUrl],
  );

  const sortedElements = useMemo(
    () => [...layoutJson].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [layoutJson],
  );

  // Auto-scale to fit container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        if (containerWidth > 0) {
          setScale(containerWidth / paper.width);
        }
      }
    });

    observer.observe(el);
    // Initial measurement
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setScale(rect.width / paper.width);

    return () => observer.disconnect();
  }, [paper.width]);

  const aspectRatio = paper.width / paper.height;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${aspectRatio}`,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {scale > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: paper.width,
            height: paper.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: backgroundColor ?? "#ffffff",
            backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {sortedElements.map((element) => (
            <div
              key={element.id}
              style={{
                position: "absolute",
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
              }}
            >
              <CanvasElementRenderer
                element={element}
                isSelected={false}
                onClick={() => {}}
                brandingUrls={brandingUrls}
                dynamicValues={renderedData ?? undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
