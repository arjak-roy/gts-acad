"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type VariableItem = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  category: string;
  sampleValue: string | null;
  isSystem: boolean;
};

const CATEGORY_ORDER = [
  "Branding", "Recipient", "General", "Authentication",
  "User Management", "Course & Program", "Assessment", "Notification",
];

function groupByCategory(items: VariableItem[]) {
  const map = new Map<string, VariableItem[]>();
  for (const item of items) {
    const list = map.get(item.category);
    if (list) list.push(item);
    else map.set(item.category, [item]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const iA = CATEGORY_ORDER.indexOf(a);
      const iB = CATEGORY_ORDER.indexOf(b);
      return (iA === -1 ? CATEGORY_ORDER.length : iA) - (iB === -1 ? CATEGORY_ORDER.length : iB) || a.localeCompare(b);
    })
    .map(([category, variables]) => ({ category, variables }));
}

export function FloatingVariablePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [variables, setVariables] = useState<VariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [position, setPosition] = useState({ x: 80, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchVariables = useCallback(async () => {
    try {
      const res = await fetch("/api/email-template-variables");
      const payload = await res.json();
      if (payload.data) setVariables(payload.data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchVariables();
  }, [open, fetchVariables]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q),
    );
  }, [variables, searchQuery]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const copyVariable = (name: string) => {
    navigator.clipboard.writeText(`{{${name}}}`).then(() => {
      toast.success(`Copied {{${name}}} to clipboard`);
    }).catch(() => {
      toast.error("Failed to copy");
    });
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-[9999] flex w-[340px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
      style={{ left: position.x, top: position.y, maxHeight: "70vh" }}
    >
      {/* Draggable header */}
      <div
        className="flex cursor-move items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50 px-4 py-2.5"
        onMouseDown={handleMouseDown}
      >
        <div>
          <p className="text-sm font-bold text-slate-800">Template Variables</p>
          <p className="text-[10px] text-slate-400">Click a variable to copy</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-slate-100 px-3 py-2">
        <Input
          placeholder="Search variables…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ maxHeight: "calc(70vh - 100px)" }}>
        {loading ? (
          <p className="py-4 text-center text-xs text-slate-400">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            {searchQuery ? "No matches." : "No variables available."}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.category}>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {group.category}
                </p>
                <div className="space-y-1">
                  {group.variables.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => copyVariable(v.name)}
                      className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-[#0d3b84] group-hover:bg-[#0d3b84]/10">
                        {`{{${v.name}}}`}
                      </code>
                      <span className="truncate text-[11px] text-slate-500">{v.label}</span>
                      {!v.isSystem && (
                        <Badge variant="accent" className="ml-auto shrink-0 text-[9px]">Custom</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
