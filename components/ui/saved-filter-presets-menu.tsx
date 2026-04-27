"use client";

import { useCallback, useState } from "react";
import { Bookmark, ChevronDown, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedFilterPreset } from "@/hooks/use-saved-filter-presets";
import { cn } from "@/lib/utils";

type SavedFilterPresetsMenuProps = {
  presets: SavedFilterPreset[];
  currentFilters: Record<string, string>;
  onApplyPreset: (filters: Record<string, string>) => void;
  onSavePreset: (name: string, filters: Record<string, string>) => void;
  onDeletePreset: (presetId: string) => void;
  className?: string;
};

export function SavedFilterPresetsMenu({
  presets,
  currentFilters,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  className,
}: SavedFilterPresetsMenuProps) {
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState("");

  const hasActiveFilters = Object.values(currentFilters).some((v) => v.length > 0);

  const handleSave = useCallback(() => {
    const name = presetName.trim();
    if (!name || !hasActiveFilters) return;
    onSavePreset(name, currentFilters);
    setPresetName("");
    setSaving(false);
  }, [presetName, hasActiveFilters, currentFilters, onSavePreset]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        setSaving(false);
        setPresetName("");
      }
    },
    [handleSave],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5", className)}>
          <Bookmark className="h-3.5 w-3.5" />
          Saved Filters
          {presets.length > 0 && (
            <Badge variant="info" className="ml-1 px-1.5 py-0 text-[10px]">
              {presets.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {presets.length > 0 ? (
          <>
            {presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                className="flex items-center justify-between gap-2"
                onSelect={(e) => {
                  e.preventDefault();
                  onApplyPreset(preset.filters);
                }}
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{preset.name}</span>
                  <span className="block truncate text-[10px] text-slate-400">
                    {Object.entries(preset.filters)
                      .filter(([, v]) => v.length > 0)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePreset(preset.id);
                  }}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <div className="px-3 py-2 text-center text-xs text-slate-400">
            No saved filters yet.
          </div>
        )}

        {saving ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <input
              autoFocus
              type="text"
              className="h-7 flex-1 rounded border border-slate-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0d3b84]"
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={40}
            />
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 px-2 text-xs"
              disabled={!presetName.trim() || !hasActiveFilters}
              onClick={handleSave}
            >
              Save
            </Button>
            <button
              type="button"
              onClick={() => { setSaving(false); setPresetName(""); }}
              className="rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <DropdownMenuItem
            disabled={!hasActiveFilters}
            onSelect={(e) => {
              e.preventDefault();
              setSaving(true);
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Save Current Filters
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
