import type { CanvasElement } from "@/services/certifications/types";

// ── Constants ────────────────────────────────────────────────────────────────

/** Distance in paper-space pixels within which a snap activates */
export const SNAP_THRESHOLD = 6;

// ── Types ────────────────────────────────────────────────────────────────────

export type SnapLineType = "element" | "canvas-center" | "canvas-edge";

export type SnapLine = {
  orientation: "horizontal" | "vertical";
  position: number;
  type: SnapLineType;
};

export type SnapTargets = {
  vertical: { position: number; type: SnapLineType }[];   // x-axis snap lines
  horizontal: { position: number; type: SnapLineType }[];  // y-axis snap lines
};

export type SnapResult = {
  x: number;
  y: number;
  guides: SnapLine[];
};

// ── Build snap targets from sibling elements + canvas geometry ───────────────

export function computeSnapTargets(
  elements: CanvasElement[],
  excludeId: string | null,
  paper: { width: number; height: number },
): SnapTargets {
  const vertical: SnapTargets["vertical"] = [];
  const horizontal: SnapTargets["horizontal"] = [];

  // Canvas edges
  vertical.push({ position: 0, type: "canvas-edge" });
  vertical.push({ position: paper.width, type: "canvas-edge" });
  horizontal.push({ position: 0, type: "canvas-edge" });
  horizontal.push({ position: paper.height, type: "canvas-edge" });

  // Canvas center lines
  vertical.push({ position: paper.width / 2, type: "canvas-center" });
  horizontal.push({ position: paper.height / 2, type: "canvas-center" });

  // Sibling element edges & centers
  for (const el of elements) {
    if (el.id === excludeId) continue;

    const left = el.x;
    const right = el.x + el.width;
    const centerX = el.x + el.width / 2;
    const top = el.y;
    const bottom = el.y + el.height;
    const centerY = el.y + el.height / 2;

    vertical.push({ position: left, type: "element" });
    vertical.push({ position: right, type: "element" });
    vertical.push({ position: centerX, type: "element" });

    horizontal.push({ position: top, type: "element" });
    horizontal.push({ position: bottom, type: "element" });
    horizontal.push({ position: centerY, type: "element" });
  }

  return { vertical, horizontal };
}

// ── Snap a dragged element to nearest targets ────────────────────────────────

export function snapPosition(
  dragX: number,
  dragY: number,
  dragW: number,
  dragH: number,
  targets: SnapTargets,
  threshold: number = SNAP_THRESHOLD,
): SnapResult {
  const guides: SnapLine[] = [];

  // Reference points for the dragged element
  const refX = [dragX, dragX + dragW / 2, dragX + dragW]; // left, center, right
  const refY = [dragY, dragY + dragH / 2, dragY + dragH]; // top, center, bottom

  let snappedX = dragX;
  let snappedY = dragY;

  // ── Snap X axis ──
  let bestDx = threshold + 1;
  let bestSnapXLines: SnapLine[] = [];

  for (const target of targets.vertical) {
    for (let i = 0; i < refX.length; i++) {
      const dist = Math.abs(refX[i] - target.position);
      if (dist < bestDx) {
        bestDx = dist;
        // offset = how much to shift dragX so refX[i] lands on target
        snappedX = dragX + (target.position - refX[i]);
        bestSnapXLines = [{ orientation: "vertical", position: target.position, type: target.type }];
      } else if (dist === bestDx && dist <= threshold) {
        // Multiple guides at same distance (e.g., element edge + canvas center align)
        bestSnapXLines.push({ orientation: "vertical", position: target.position, type: target.type });
      }
    }
  }
  if (bestDx <= threshold) {
    guides.push(...bestSnapXLines);
  } else {
    snappedX = dragX;
  }

  // ── Snap Y axis ──
  let bestDy = threshold + 1;
  let bestSnapYLines: SnapLine[] = [];

  for (const target of targets.horizontal) {
    for (let i = 0; i < refY.length; i++) {
      const dist = Math.abs(refY[i] - target.position);
      if (dist < bestDy) {
        bestDy = dist;
        snappedY = dragY + (target.position - refY[i]);
        bestSnapYLines = [{ orientation: "horizontal", position: target.position, type: target.type }];
      } else if (dist === bestDy && dist <= threshold) {
        bestSnapYLines.push({ orientation: "horizontal", position: target.position, type: target.type });
      }
    }
  }
  if (bestDy <= threshold) {
    guides.push(...bestSnapYLines);
  } else {
    snappedY = dragY;
  }

  return { x: snappedX, y: snappedY, guides };
}

// ── Snap a resizing element edge ─────────────────────────────────────────────

export type ResizeSnapResult = {
  width: number;
  height: number;
  x: number;
  y: number;
  guides: SnapLine[];
};

/**
 * Snap edges that move during a resize operation.
 * `direction` encodes which edges are being dragged (react-rnd direction string).
 */
export function snapResize(
  x: number,
  y: number,
  width: number,
  height: number,
  direction: string,
  targets: SnapTargets,
  threshold: number = SNAP_THRESHOLD,
): ResizeSnapResult {
  const guides: SnapLine[] = [];

  let newX = x;
  let newY = y;
  let newW = width;
  let newH = height;

  // Which edges are being resized
  const resizesRight = direction.includes("right") || direction === "right";
  const resizesLeft = direction.includes("left") || direction === "left";
  const resizesBottom = direction.includes("bottom") || direction === "bottom";
  const resizesTop = direction.includes("top") || direction === "top";

  // ── Snap right edge ──
  if (resizesRight) {
    const rightEdge = x + width;
    const centerX = x + width / 2;
    let bestDist = threshold + 1;

    for (const target of targets.vertical) {
      // Snap right edge
      const distRight = Math.abs(rightEdge - target.position);
      if (distRight < bestDist) {
        bestDist = distRight;
        newW = target.position - x;
        guides.push({ orientation: "vertical", position: target.position, type: target.type });
      }
      // Also snap center during right resize
      const distCenter = Math.abs(centerX - target.position);
      if (distCenter < bestDist) {
        bestDist = distCenter;
        // centerX should be target.position → width = 2 * (target.position - x)
        newW = 2 * (target.position - x);
        guides.push({ orientation: "vertical", position: target.position, type: target.type });
      }
    }
    if (bestDist > threshold) {
      newW = width;
    }
  }

  // ── Snap left edge ──
  if (resizesLeft) {
    const leftEdge = x;
    let bestDist = threshold + 1;

    for (const target of targets.vertical) {
      const dist = Math.abs(leftEdge - target.position);
      if (dist < bestDist) {
        bestDist = dist;
        const delta = leftEdge - target.position;
        newX = target.position;
        newW = width + delta;
        guides.push({ orientation: "vertical", position: target.position, type: target.type });
      }
    }
    if (bestDist > threshold) {
      newX = x;
      newW = resizesRight ? newW : width;
    }
  }

  // ── Snap bottom edge ──
  if (resizesBottom) {
    const bottomEdge = y + height;
    const centerY = y + height / 2;
    let bestDist = threshold + 1;

    for (const target of targets.horizontal) {
      const distBottom = Math.abs(bottomEdge - target.position);
      if (distBottom < bestDist) {
        bestDist = distBottom;
        newH = target.position - y;
        guides.push({ orientation: "horizontal", position: target.position, type: target.type });
      }
      const distCenter = Math.abs(centerY - target.position);
      if (distCenter < bestDist) {
        bestDist = distCenter;
        newH = 2 * (target.position - y);
        guides.push({ orientation: "horizontal", position: target.position, type: target.type });
      }
    }
    if (bestDist > threshold) {
      newH = height;
    }
  }

  // ── Snap top edge ──
  if (resizesTop) {
    const topEdge = y;
    let bestDist = threshold + 1;

    for (const target of targets.horizontal) {
      const dist = Math.abs(topEdge - target.position);
      if (dist < bestDist) {
        bestDist = dist;
        const delta = topEdge - target.position;
        newY = target.position;
        newH = height + delta;
        guides.push({ orientation: "horizontal", position: target.position, type: target.type });
      }
    }
    if (bestDist > threshold) {
      newY = y;
      newH = resizesBottom ? newH : height;
    }
  }

  // Deduplicate guides
  const uniqueGuides = guides.filter(
    (g, i, arr) =>
      arr.findIndex((o) => o.orientation === g.orientation && o.position === g.position) === i,
  );

  return { x: newX, y: newY, width: newW, height: newH, guides: uniqueGuides };
}
