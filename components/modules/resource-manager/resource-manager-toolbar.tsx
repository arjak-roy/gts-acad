"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FileText,
  FolderPlus,
  Grid3X3,
  Link2,
  List,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useResourceManager } from "./resource-manager-types";

export function ResourceManagerToolbar() {
  const {
    mode,
    lookups,
    selectedFolderId,
    setSelectedFolderId,
    viewMode,
    setViewMode,
    filters,
    setFilters,
    setInlineCreateParentId,
    renamingFolderId,
    setRenamingFolderId,
    selectedResourceIds,
    clearSelection,
    folderTree,
    deleteFolder,
  } = useResourceManager();

  // Local search state with debounce to avoid API call per keystroke
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 350);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters({ ...filters, search: debouncedSearch, page: 1 });
    }
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local input if filters.search is cleared externally
  useEffect(() => {
    if (!filters.search && searchInput) {
      setSearchInput("");
    }
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGoUp = selectedFolderId !== null;

  function handleGoUp() {
    if (!selectedFolderId) return;
    const current = lookups.folders.find((f) => f.id === selectedFolderId);
    setSelectedFolderId(current?.parentId ?? null);
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5">
      {/* Navigation group */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="Forward">
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!canGoUp}
          onClick={() => setSelectedFolderId(null)}
          title="Up to parent folder"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      <Divider />

      {/* Organize group */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => setInlineCreateParentId(selectedFolderId)}
          title="New Folder (Ctrl+Shift+N)"
        >
          <FolderPlus className="h-4 w-4" />
          <span className="hidden sm:inline">New Folder</span>
        </Button>
        {selectedFolderId && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => setRenamingFolderId(selectedFolderId)}
              title="Rename Folder (F2)"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rename</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-red-600 hover:text-red-700"
              onClick={() => {
                if (selectedFolderId && confirm("Delete this folder? Only empty folders can be deleted.")) {
                  void deleteFolder(selectedFolderId);
                }
              }}
              title="Delete Folder"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </>
        )}
      </div>

      <Divider />

      {/* New / Upload group */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => {
            // Trigger file input click
            const input = document.getElementById("rm-file-upload-input") as HTMLInputElement | null;
            input?.click();
          }}
          title="Upload Files"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("rm:new-article"));
          }}
          title="New Article"
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Article</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("rm:new-link"));
          }}
          title="New Link"
        >
          <Link2 className="h-4 w-4" />
          <span className="hidden sm:inline">Link</span>
        </Button>
      </div>

      <Divider />

      {/* View group */}
      <div className="flex items-center gap-0.5">
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setViewMode("list")}
          title="List view"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setViewMode("grid")}
          title="Grid view"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </div>

      {/* Selection info (pick mode) */}
      {mode === "pick" && selectedResourceIds.size > 0 && (
        <>
          <Divider />
          <div className="flex items-center gap-2 pl-1">
            <span className="text-xs font-medium text-primary">{selectedResourceIds.size} selected</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </>
      )}

      {/* Spacer + Search */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 rounded-lg pl-8 pr-8 text-xs"
            placeholder="Search files…"
          />
          {searchInput ? (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => {
                setSearchInput("");
                setFilters({ ...filters, search: "", page: 1 });
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-1.5 h-5 w-px bg-slate-200" />;
}
