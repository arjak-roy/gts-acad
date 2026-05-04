"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, HardDrive } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useResourceManager, type FolderTreeNode } from "./resource-manager-types";

export function ResourceManagerFolderTree() {
  const {
    folderTree,
    selectedFolderId,
    setSelectedFolderId,
    inlineCreateParentId,
    setInlineCreateParentId,
    createFolder,
  } = useResourceManager();

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Folders</h3>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Root node */}
        <RootNode />

        {/* Inline create at root */}
        {inlineCreateParentId === null && (
          <InlineCreateInput
            depth={1}
            onConfirm={async (name) => {
              const ok = await createFolder(name, null);
              if (ok) setInlineCreateParentId(null);
              return ok;
            }}
            onCancel={() => setInlineCreateParentId(null)}
          />
        )}

        {/* Folder tree nodes */}
        {folderTree.map((node) => (
          <FolderNode key={node.id} node={node} depth={1} />
        ))}
      </div>
    </div>
  );
}

// ─── Root Node ───────────────────────────────────────────────────────────────

function RootNode() {
  const { selectedFolderId, setSelectedFolderId } = useResourceManager();
  const isSelected = selectedFolderId === null;

  const { setNodeRef, isOver } = useDroppable({ id: "folder-root" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        isSelected && "bg-primary/10 font-medium text-primary",
        !isSelected && "text-slate-700 hover:bg-slate-50",
        isOver && "ring-2 ring-primary/40",
      )}
      onClick={() => setSelectedFolderId(null)}
    >
      <HardDrive className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="truncate">Repository Root</span>
    </div>
  );
}

// ─── Folder Node ─────────────────────────────────────────────────────────────

function FolderNode({ node, depth }: { node: FolderTreeNode; depth: number }) {
  const {
    selectedFolderId,
    setSelectedFolderId,
    inlineCreateParentId,
    setInlineCreateParentId,
    renamingFolderId,
    setRenamingFolderId,
    createFolder,
    renameFolder,
  } = useResourceManager();

  const [isExpanded, setIsExpanded] = useState(false);
  const isSelected = selectedFolderId === node.id;
  const isRenaming = renamingFolderId === node.id;

  const { setNodeRef, isOver } = useDroppable({ id: `folder-${node.id}` });

  // Auto-expand when a child is being inline-created
  useEffect(() => {
    if (inlineCreateParentId === node.id && !isExpanded) {
      setIsExpanded(true);
    }
  }, [inlineCreateParentId, node.id, isExpanded]);

  const handleClick = () => {
    setSelectedFolderId(node.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleDoubleClick = () => {
    setRenamingFolderId(node.id);
  };

  return (
    <div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-3 text-sm transition-colors",
          isSelected && "bg-primary/10 font-medium text-primary",
          !isSelected && "text-slate-700 hover:bg-slate-50",
          isOver && "ring-2 ring-primary/40",
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Expand/Collapse toggle */}
        <button
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-200/70"
          onClick={handleToggle}
        >
          {node.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
        )}

        {/* Name / rename input */}
        {isRenaming ? (
          <InlineRenameInput
            initialValue={node.name}
            onConfirm={async (name) => {
              const ok = await renameFolder(node.id, name);
              if (ok) setRenamingFolderId(null);
              return ok;
            }}
            onCancel={() => setRenamingFolderId(null)}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {/* Children */}
      {isExpanded && (
        <div>
          {/* Inline create under this folder */}
          {inlineCreateParentId === node.id && (
            <InlineCreateInput
              depth={depth + 1}
              onConfirm={async (name) => {
                const ok = await createFolder(name, node.id);
                if (ok) setInlineCreateParentId(null);
                return ok;
              }}
              onCancel={() => setInlineCreateParentId(null)}
            />
          )}
          {node.children.map((child) => (
            <FolderNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline Create Input ─────────────────────────────────────────────────────

function InlineCreateInput({
  depth,
  onConfirm,
  onCancel,
}: {
  depth: number;
  onConfirm: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const name = value.trim();
    if (!name) {
      onCancel();
      return;
    }
    setIsSaving(true);
    await onConfirm(name);
    setIsSaving(false);
  };

  return (
    <div
      className="flex items-center gap-1 py-1 pr-3"
      style={{ paddingLeft: `${depth * 16 + 4 + 24}px` }}
    >
      <Folder className="h-4 w-4 shrink-0 text-amber-500" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSubmit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (!isSaving) onCancel();
        }}
        className="h-6 flex-1 rounded-sm border-primary/50 px-1.5 py-0 text-sm focus-visible:ring-1"
        placeholder="Folder name…"
        disabled={isSaving}
      />
    </div>
  );
}

// ─── Inline Rename Input ─────────────────────────────────────────────────────

function InlineRenameInput({
  initialValue,
  onConfirm,
  onCancel,
}: {
  initialValue: string;
  onConfirm: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async () => {
    const name = value.trim();
    if (!name || name === initialValue) {
      onCancel();
      return;
    }
    setIsSaving(true);
    await onConfirm(name);
    setIsSaving(false);
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void handleSubmit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (!isSaving) onCancel();
      }}
      className="h-6 flex-1 rounded-sm border-primary/50 px-1.5 py-0 text-sm focus-visible:ring-1"
      disabled={isSaving}
    />
  );
}
