"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import {
  Type,
  Variable,
  Image,
  QrCode,
  Square,
  Frame,
  ZoomIn,
  ZoomOut,
  Save,
  Undo2,
  Magnet,
} from "lucide-react";
import type { CanvasElement } from "@/services/certifications/types";
import type { CertificateTemplateDetail } from "@/services/certifications/types";
import { Button } from "@/components/ui/button";
import { CanvasElementRenderer } from "./canvas-element-renderer";
import type { BrandingUrls } from "./canvas-element-renderer";
import { ElementPropertyPanel } from "./element-property-panel";
import { CanvasGuideLines } from "./canvas-guide-lines";
import { computeSnapTargets, snapPosition, snapResize } from "./canvas-snap-utils";
import type { SnapLine } from "./canvas-snap-utils";
import { getPaperSize } from "./paper-utils";

// ── Element factory ──────────────────────────────────────────────────────────

let idCounter = Date.now();
function nextId() {
  return `el-${++idCounter}`;
}

function createDefaultElement(type: CanvasElement["type"]): CanvasElement {
  const base = { id: nextId(), x: 50, y: 50, width: 200, height: 40, zIndex: 1 };

  switch (type) {
    case "text":
      return { ...base, type: "text", content: "Certificate of Completion", fontSize: 28, fontFamily: "serif", fontWeight: "bold", textAlign: "center", color: "#1a1a1a" };
    case "dynamic-text":
      return { ...base, type: "dynamic-text", template: "{{learnerName}}", fontSize: 22, fontFamily: "serif", fontWeight: "bold", textAlign: "center", color: "#0d3b84" };
    case "image":
      return { ...base, type: "image", source: "logo", width: 120, height: 80, objectFit: "contain" };
    case "qr-code":
      return { ...base, type: "qr-code", width: 100, height: 100 };
    case "shape":
      return { ...base, type: "shape", shape: "rectangle", width: 200, height: 3, fillColor: "#d4a853", strokeColor: "transparent" };
    case "border":
      return { ...base, type: "border", width: 750, height: 550, x: 22, y: 22, borderColor: "#d4a853", borderWidth: 3, borderStyle: "double", borderRadius: 8 };
    default:
      return { ...base, type: "text", content: "" } as CanvasElement;
  }
}

// ── Tool bar ─────────────────────────────────────────────────────────────────

const TOOLS: { type: CanvasElement["type"]; icon: React.ElementType; label: string }[] = [
  { type: "text", icon: Type, label: "Text" },
  { type: "dynamic-text", icon: Variable, label: "Dynamic" },
  { type: "image", icon: Image, label: "Image" },
  { type: "qr-code", icon: QrCode, label: "QR Code" },
  { type: "shape", icon: Square, label: "Shape" },
  { type: "border", icon: Frame, label: "Border" },
];

// ── Main canvas editor ──────────────────────────────────────────────────────

type Props = {
  template: CertificateTemplateDetail;
  onSave: (elements: CanvasElement[]) => Promise<void>;
  isSaving?: boolean;
};

export function CertificateCanvasEditor({ template, onSave, isSaving }: Props) {
  const [elements, setElements] = useState<CanvasElement[]>(
    () => (template.layoutJson ?? []) as CanvasElement[],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activeGuides, setActiveGuides] = useState<SnapLine[]>([]);
  const dragUndoPushedRef = useRef<string | null>(null);

  const paper = useMemo(
    () => getPaperSize(template.paperSize, template.orientation),
    [template.paperSize, template.orientation],
  );

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;

  const brandingUrls = useMemo<BrandingUrls>(
    () => ({
      logo: template.logoUrl ?? null,
      signature1: template.signatory1SignatureUrl ?? null,
      signature2: template.signatory2SignatureUrl ?? null,
      background: template.backgroundImageUrl ?? null,
    }),
    [template.logoUrl, template.signatory1SignatureUrl, template.signatory2SignatureUrl, template.backgroundImageUrl],
  );

  // ── History ────────────────────────────────────────────────────────────────

  const pushUndo = useCallback((prev: CanvasElement[]) => {
    setUndoStack((stack) => [...stack.slice(-19), prev]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setElements(prev);
      return stack.slice(0, -1);
    });
  }, []);

  // ── Element CRUD ───────────────────────────────────────────────────────────

  const addElement = useCallback(
    (type: CanvasElement["type"]) => {
      pushUndo(elements);
      const newEl = createDefaultElement(type);
      setElements((prev) => [...prev, newEl]);
      setSelectedId(newEl.id);
    },
    [elements, pushUndo],
  );

  const updateElement = useCallback(
    (updated: CanvasElement) => {
      pushUndo(elements);
      setElements((prev) => prev.map((el) => (el.id === updated.id ? updated : el)));
    },
    [elements, pushUndo],
  );

  const deleteElement = useCallback(
    (id: string) => {
      pushUndo(elements);
      setElements((prev) => prev.filter((el) => el.id !== id));
      setSelectedId(null);
    },
    [elements, pushUndo],
  );

  // ── Snap targets (recomputed when elements change) ────────────────────────

  const snapTargetsFor = useCallback(
    (excludeId: string) => computeSnapTargets(elements, excludeId, paper),
    [elements, paper],
  );

  // ── Drag / Resize handlers ────────────────────────────────────────────────

  const handleDrag = useCallback(
    (id: string, x: number, y: number) => {
      // Push undo once at drag start (not on every move)
      if (dragUndoPushedRef.current !== id) {
        pushUndo(elements);
        dragUndoPushedRef.current = id;
      }

      const el = elements.find((e) => e.id === id);
      if (!el) return;

      if (snapEnabled) {
        const targets = snapTargetsFor(id);
        const result = snapPosition(x, y, el.width, el.height, targets);
        setActiveGuides(result.guides);
        setElements((prev) =>
          prev.map((e) => (e.id === id ? { ...e, x: Math.round(result.x), y: Math.round(result.y) } : e)),
        );
      } else {
        setElements((prev) =>
          prev.map((e) => (e.id === id ? { ...e, x: Math.round(x), y: Math.round(y) } : e)),
        );
      }
    },
    [elements, snapEnabled, snapTargetsFor, pushUndo],
  );

  const handleDragStop = useCallback(
    (_id: string) => {
      setActiveGuides([]);
      dragUndoPushedRef.current = null;
    },
    [],
  );

  const handleResize = useCallback(
    (id: string, width: number, height: number, x: number, y: number, direction: string) => {
      if (dragUndoPushedRef.current !== id) {
        pushUndo(elements);
        dragUndoPushedRef.current = id;
      }

      if (snapEnabled) {
        const targets = snapTargetsFor(id);
        const result = snapResize(x, y, width, height, direction, targets);
        setActiveGuides(result.guides);
        setElements((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, x: Math.round(result.x), y: Math.round(result.y), width: Math.round(result.width), height: Math.round(result.height) }
              : e,
          ),
        );
      } else {
        setElements((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
              : e,
          ),
        );
      }
    },
    [elements, snapEnabled, snapTargetsFor, pushUndo],
  );

  const handleResizeStop = useCallback(
    () => {
      setActiveGuides([]);
      dragUndoPushedRef.current = null;
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const sortedElements = useMemo(
    () => [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [elements],
  );

  return (
    <div className="flex h-full gap-0">
      {/* Left: Toolbar + Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <span className="mr-2 text-xs font-semibold text-slate-500 uppercase">Add</span>
          {TOOLS.map((tool) => (
            <button
              key={tool.type}
              type="button"
              onClick={() => addElement(tool.type)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm"
              title={tool.label}
            >
              <tool.icon className="h-3.5 w-3.5" />
              {tool.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSnapEnabled((v) => !v)}
              className={`rounded-lg p-1.5 transition-colors ${
                snapEnabled
                  ? "bg-[#0d3b84] text-white shadow-sm"
                  : "text-slate-400 hover:bg-white hover:text-slate-700"
              }`}
              title={snapEnabled ? "Snap to guides (on)" : "Snap to guides (off)"}
            >
              <Magnet className="h-4 w-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 disabled:opacity-30"
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <Button
              size="sm"
              onClick={() => onSave(elements)}
              disabled={isSaving}
              className="ml-2"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {isSaving ? "Saving…" : "Save Layout"}
            </Button>
          </div>
        </div>

        {/* Canvas area */}
        <div
          className="flex-1 overflow-auto bg-slate-100"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="flex items-start justify-center p-8" style={{ minHeight: paper.height * zoom + 80 }}>
            <div
              className="relative shadow-xl"
              style={{
                width: paper.width * zoom,
                height: paper.height * zoom,
                backgroundColor: template.backgroundColor ?? "#ffffff",
                backgroundImage: template.backgroundImageUrl ? `url(${template.backgroundImageUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                transform: `scale(1)`,
                transformOrigin: "top left",
              }}
            >
              {/* Inner scaled container */}
              <div
                style={{
                  width: paper.width,
                  height: paper.height,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  position: "relative",
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelectedId(null);
                }}
              >
                {sortedElements.map((el) => (
                  <Rnd
                    key={el.id}
                    position={{ x: el.x, y: el.y }}
                    size={{ width: el.width, height: el.height }}
                    onDrag={(_e, d) => handleDrag(el.id, d.x, d.y)}
                    onDragStop={() => handleDragStop(el.id)}
                    onResize={(_e, dir, ref, _delta, pos) =>
                      handleResize(el.id, ref.offsetWidth, ref.offsetHeight, pos.x, pos.y, dir)
                    }
                    onResizeStop={() => handleResizeStop()}
                    bounds="parent"
                    scale={zoom}
                    style={{ zIndex: el.zIndex ?? 0 }}
                    onMouseDown={() => setSelectedId(el.id)}
                  >
                    <CanvasElementRenderer
                      element={el}
                      isSelected={selectedId === el.id}
                      onClick={() => setSelectedId(el.id)}
                      brandingUrls={brandingUrls}
                    />
                  </Rnd>
                ))}

                {/* Snap alignment guides */}
                <CanvasGuideLines guides={activeGuides} paper={paper} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Property panel */}
      <div className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        {selectedElement ? (
          <ElementPropertyPanel
            element={selectedElement}
            onChange={updateElement}
            onDelete={() => deleteElement(selectedElement.id)}
            templateId={template.id}
            brandingUrls={brandingUrls}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Frame className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-400">Select an element</p>
            <p className="mt-1 text-xs text-slate-400">
              Click an element on the canvas to edit its properties, or use the toolbar to add new elements.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
