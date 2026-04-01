import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const CARD_LAYOUT_PRESETS = ["compact", "balanced", "focus"] as const;

export type CardLayoutPreset = (typeof CARD_LAYOUT_PRESETS)[number];
export type CardLayoutSpan = "normal" | "wide" | "tall" | "hero";

export function parseCardLayoutPreset(value: string | null | undefined): CardLayoutPreset {
  if (value === "compact" || value === "focus") {
    return value;
  }

  return "balanced";
}

type FlexibleCardGridProps = {
  preset: CardLayoutPreset;
  className?: string;
  children: ReactNode;
};

export function FlexibleCardGrid({ preset, className, children }: FlexibleCardGridProps) {
  const presetClass =
    preset === "compact"
      ? "[--card-width:220px]"
      : preset === "focus"
        ? "[--card-width:360px]"
        : "[--card-width:280px]";

  return <div className={cn("flex flex-wrap items-start gap-3", presetClass, className)}>{children}</div>;
}

type FlexibleCardItemProps = {
  span?: CardLayoutSpan;
  minHeightClassName?: string;
  resizable?: boolean;
  className?: string;
  children: ReactNode;
};

export function FlexibleCardItem({
  span = "normal",
  minHeightClassName = "min-h-[180px]",
  resizable = true,
  className,
  children,
}: FlexibleCardItemProps) {
  const spanClass =
    span === "hero"
      ? "md:[width:min(100%,calc(var(--card-width)*2+0.75rem))]"
      : span === "wide"
        ? "md:[width:min(100%,calc(var(--card-width)*2+0.75rem))]"
        : span === "tall"
          ? "md:[width:var(--card-width)] md:min-h-[320px]"
          : "md:[width:var(--card-width)]";

  return (
    <div
      className={cn(
        "w-full max-w-full shrink-0 overflow-auto rounded-2xl md:max-w-full",
        minHeightClassName,
        spanClass,
        resizable ? "resize-none md:resize" : "resize-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
