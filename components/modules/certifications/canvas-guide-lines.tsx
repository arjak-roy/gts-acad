"use client";

import React from "react";
import type { SnapLine } from "./canvas-snap-utils";

// ── Guide line colors by snap type ───────────────────────────────────────────

const GUIDE_COLORS: Record<SnapLine["type"], string> = {
  element: "#0d3b84",        // brand blue — element-to-element alignment
  "canvas-center": "#d4a853", // gold accent — canvas center lines
  "canvas-edge": "#94a3b8",   // slate — canvas edge alignment
};

const GUIDE_DASH: Record<SnapLine["type"], string> = {
  element: "none",
  "canvas-center": "4 3",
  "canvas-edge": "2 2",
};

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  guides: SnapLine[];
  paper: { width: number; height: number };
};

export function CanvasGuideLines({ guides, paper }: Props) {
  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, i) => {
        const isVertical = guide.orientation === "vertical";
        const color = GUIDE_COLORS[guide.type];
        const dash = GUIDE_DASH[guide.type];

        if (isVertical) {
          return (
            <svg
              key={`v-${guide.position}-${i}`}
              className="pointer-events-none absolute left-0 top-0"
              style={{ zIndex: 9999 }}
              width={paper.width}
              height={paper.height}
            >
              <line
                x1={guide.position}
                y1={0}
                x2={guide.position}
                y2={paper.height}
                stroke={color}
                strokeWidth={1}
                strokeDasharray={dash}
                opacity={0.85}
              />
            </svg>
          );
        }

        return (
          <svg
            key={`h-${guide.position}-${i}`}
            className="pointer-events-none absolute left-0 top-0"
            style={{ zIndex: 9999 }}
            width={paper.width}
            height={paper.height}
          >
            <line
              x1={0}
              y1={guide.position}
              x2={paper.width}
              y2={guide.position}
              stroke={color}
              strokeWidth={1}
              strokeDasharray={dash}
              opacity={0.85}
            />
          </svg>
        );
      })}
    </>
  );
}
