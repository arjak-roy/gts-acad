"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  CheckCircle2,
  ChevronDown,
  Code,
  Code2,
  Columns,
  Eye,
  FileText,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Image as ImageIcon,
  Info,
  Italic,
  LayoutList,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
  Paperclip,
  PencilLine,
  Quote,
  Redo,
  RemoveFormatting,
  Rows,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  TableProperties,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo,
  Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalloutType } from "./callout-extension";

type RibbonTab = "home" | "insert" | "view" | "table";

type StudioMode = "write" | "preview";

export type PanelVisibility = {
  structure: boolean;
  outline: boolean;
  preview: boolean;
  quality: boolean;
};

type ContentStudioRibbonProps = {
  editor: Editor;
  disabled?: boolean;
  studioMode: StudioMode;
  onStudioModeChange: (mode: StudioMode) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  panels: PanelVisibility;
  onTogglePanel: (panel: keyof PanelVisibility) => void;
  onOpenLinkDialog: () => void;
  onOpenImageDialog: () => void;
  onOpenYoutubeDialog: () => void;
  onOpenResourcePicker: () => void;
  onOpenFilePicker: () => void;
};

const FONT_SIZES = [
  { label: "Small", value: "0.85em" },
  { label: "Normal", value: "" },
  { label: "Large", value: "1.25em" },
  { label: "XL", value: "1.5em" },
];

const CALLOUT_TYPES: { value: CalloutType; label: string; icon: string }[] = [
  { value: "info", label: "Info", icon: "ℹ️" },
  { value: "tip", label: "Tip", icon: "💡" },
  { value: "warning", label: "Warning", icon: "⚠️" },
  { value: "danger", label: "Danger", icon: "🚨" },
];

const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
];

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Orange", value: "#ea580c" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Gray", value: "#6b7280" },
];

export function ContentStudioRibbon({
  editor,
  disabled,
  studioMode,
  onStudioModeChange,
  isFullscreen,
  onToggleFullscreen,
  panels,
  onTogglePanel,
  onOpenLinkDialog,
  onOpenImageDialog,
  onOpenYoutubeDialog,
  onOpenResourcePicker,
  onOpenFilePicker,
}: ContentStudioRibbonProps) {
  const isInTable = editor.isActive("table");
  const [activeTab, setActiveTab] = useState<RibbonTab>(isInTable ? "table" : "home");

  // Auto-switch to table tab when cursor enters table
  const effectiveTab = isInTable && activeTab !== "table" && activeTab !== "view" ? activeTab : activeTab;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-slate-100 px-2">
        <TabButton active={effectiveTab === "home"} onClick={() => setActiveTab("home")}>Home</TabButton>
        <TabButton active={effectiveTab === "insert"} onClick={() => setActiveTab("insert")}>Insert</TabButton>
        {isInTable ? <TabButton active={effectiveTab === "table"} onClick={() => setActiveTab("table")}>Table</TabButton> : null}
        <TabButton active={effectiveTab === "view"} onClick={() => setActiveTab("view")}>View</TabButton>
      </div>

      {/* Ribbon content */}
      <div className="px-2 py-1.5">
        {effectiveTab === "home" ? (
          <HomeRibbon editor={editor} disabled={disabled} />
        ) : effectiveTab === "insert" ? (
          <InsertRibbon
            editor={editor}
            disabled={disabled}
            onOpenLinkDialog={onOpenLinkDialog}
            onOpenImageDialog={onOpenImageDialog}
            onOpenYoutubeDialog={onOpenYoutubeDialog}
            onOpenResourcePicker={onOpenResourcePicker}
            onOpenFilePicker={onOpenFilePicker}
          />
        ) : effectiveTab === "table" ? (
          <TableRibbon editor={editor} disabled={disabled} />
        ) : (
          <ViewRibbon
            studioMode={studioMode}
            onStudioModeChange={onStudioModeChange}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            panels={panels}
            onTogglePanel={onTogglePanel}
          />
        )}
      </div>
    </div>
  );
}

// ─── HOME TAB ────────────────────────────────────────────────────────────────

function HomeRibbon({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-0.5">
      <RibbonSection label="History">
        <RibbonBtn active={false} disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Font">
        <RibbonBtn active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("underline")} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("strike")} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("superscript")} disabled={disabled} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
          <Superscript className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("subscript")} disabled={disabled} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
          <Subscript className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("code")} disabled={disabled} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code">
          <Code className="h-3.5 w-3.5" />
        </RibbonBtn>
        <FontSizeDropdown editor={editor} disabled={disabled} />
        <HighlightDropdown editor={editor} disabled={disabled} />
        <TextColorDropdown editor={editor} disabled={disabled} />
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Paragraph">
        <RibbonBtn active={editor.isActive({ textAlign: "left" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive({ textAlign: "center" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive({ textAlign: "right" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("taskList")} disabled={disabled} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task List">
          <ListChecks className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Styles">
        <RibbonBtn active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("heading", { level: 3 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("heading", { level: 4 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">
          <Heading4 className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("blockquote")} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>
    </div>
  );
}

// ─── INSERT TAB ──────────────────────────────────────────────────────────────

function InsertRibbon({
  editor,
  disabled,
  onOpenLinkDialog,
  onOpenImageDialog,
  onOpenYoutubeDialog,
  onOpenResourcePicker,
  onOpenFilePicker,
}: {
  editor: Editor;
  disabled?: boolean;
  onOpenLinkDialog: () => void;
  onOpenImageDialog: () => void;
  onOpenYoutubeDialog: () => void;
  onOpenResourcePicker: () => void;
  onOpenFilePicker: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-0.5">
      <RibbonSection label="Media">
        <RibbonBtn active={false} disabled={disabled} onClick={onOpenImageDialog} title="Insert Image">
          <ImageIcon className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={onOpenYoutubeDialog} title="Embed YouTube Video">
          <Youtube className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Links">
        <RibbonBtn active={editor.isActive("link")} disabled={disabled} onClick={onOpenLinkDialog} title="Insert Hyperlink">
          <LinkIcon className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={onOpenResourcePicker} title="Embed Content from Repository">
          <FileText className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Blocks">
        <RibbonBtn active={editor.isActive("table")} disabled={disabled} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
          <TableIcon className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive("codeBlock")} disabled={disabled} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
          <Code2 className="h-3.5 w-3.5" />
        </RibbonBtn>
        <CalloutRibbonDropdown editor={editor} disabled={disabled} />
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Files">
        <RibbonBtn active={false} disabled={disabled} onClick={onOpenFilePicker} title="Attach File">
          <Paperclip className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>
    </div>
  );
}

// ─── TABLE TAB (CONTEXTUAL) ─────────────────────────────────────────────────

function TableRibbon({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-0.5">
      <RibbonSection label="Rows">
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above">
          <BetweenHorizontalStart className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below">
          <BetweenHorizontalEnd className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
          <Rows className="h-3.5 w-3.5 text-rose-500" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Columns">
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Left">
          <BetweenVerticalStart className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column Right">
          <BetweenVerticalEnd className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
          <Columns className="h-3.5 w-3.5 text-rose-500" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Cells">
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">
          <TableProperties className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Table">
        <RibbonBtn active={false} disabled={disabled} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
        </RibbonBtn>
      </RibbonSection>
    </div>
  );
}

// ─── VIEW TAB ────────────────────────────────────────────────────────────────

function ViewRibbon({
  studioMode,
  onStudioModeChange,
  isFullscreen,
  onToggleFullscreen,
  panels,
  onTogglePanel,
}: {
  studioMode: StudioMode;
  onStudioModeChange: (mode: StudioMode) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  panels: PanelVisibility;
  onTogglePanel: (panel: keyof PanelVisibility) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-0.5">
      <RibbonSection label="Mode">
        <RibbonBtn active={studioMode === "write"} onClick={() => onStudioModeChange("write")} title="Write Mode">
          <PencilLine className="h-3.5 w-3.5" />
          <span className="text-[10px]">Write</span>
        </RibbonBtn>
        <RibbonBtn active={studioMode === "preview"} onClick={() => onStudioModeChange("preview")} title="Preview Mode">
          <Eye className="h-3.5 w-3.5" />
          <span className="text-[10px]">Preview</span>
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Panels">
        <RibbonBtn active={panels.structure} onClick={() => onTogglePanel("structure")} title="Toggle Structure Panel">
          <PanelLeft className="h-3.5 w-3.5" />
          <span className="text-[10px]">Structure</span>
        </RibbonBtn>
        <RibbonBtn active={panels.outline} onClick={() => onTogglePanel("outline")} title="Toggle Outline Panel">
          <LayoutList className="h-3.5 w-3.5" />
          <span className="text-[10px]">Outline</span>
        </RibbonBtn>
        <RibbonBtn active={panels.preview} onClick={() => onTogglePanel("preview")} title="Toggle Live Preview Panel">
          <Eye className="h-3.5 w-3.5" />
          <span className="text-[10px]">Preview</span>
        </RibbonBtn>
        <RibbonBtn active={panels.quality} onClick={() => onTogglePanel("quality")} title="Toggle Quality Panel">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-[10px]">Quality</span>
        </RibbonBtn>
      </RibbonSection>

      <RibbonDivider />

      <RibbonSection label="Window">
        <RibbonBtn active={isFullscreen} onClick={onToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="text-[10px]">{isFullscreen ? "Exit" : "Full"}</span>
        </RibbonBtn>
      </RibbonSection>
    </div>
  );
}

// ─── DROPDOWN SUB-COMPONENTS ─────────────────────────────────────────────────

function FontSizeDropdown({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = editor.getAttributes("textStyle").fontSize;
  const currentLabel = FONT_SIZES.find((s) => s.value === current)?.label || "Normal";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((c) => !c)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-medium transition-colors",
          "text-slate-600 hover:bg-slate-100",
          disabled && "cursor-not-allowed opacity-40",
        )}
        title="Font Size"
      >
        <Type className="h-3 w-3" />
        <span>{currentLabel}</span>
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {FONT_SIZES.map((size) => (
            <button
              key={size.label}
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-xs hover:bg-slate-50",
                current === size.value ? "font-semibold text-[#0d3b84]" : "text-slate-700",
              )}
              onClick={() => {
                if (size.value) {
                  editor.chain().focus().setMark("textStyle", { fontSize: size.value }).run();
                } else {
                  editor.chain().focus().unsetMark("textStyle").run();
                }
                setOpen(false);
              }}
            >
              {size.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HighlightDropdown({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((c) => !c)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          editor.isActive("highlight") ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100",
          disabled && "cursor-not-allowed opacity-40",
        )}
        title="Highlight"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: color.value }).run();
                setOpen(false);
              }}
            >
              <span className="h-3 w-3 rounded-sm border border-slate-200" style={{ background: color.value }} />
              {color.label}
            </button>
          ))}
          {editor.isActive("highlight") ? (
            <>
              <div className="my-1 h-px bg-slate-100" />
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setOpen(false);
                }}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TextColorDropdown({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = editor.getAttributes("textStyle").color;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((c) => !c)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          current ? "text-slate-900" : "text-slate-500 hover:bg-slate-100",
          disabled && "cursor-not-allowed opacity-40",
        )}
        title="Text Color"
      >
        <span className="relative">
          <Type className="h-3.5 w-3.5" />
          {current ? <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full" style={{ background: current }} /> : null}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {TEXT_COLORS.map((color) => (
            <button
              key={color.label}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                if (color.value) {
                  editor.chain().focus().setColor(color.value).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
                setOpen(false);
              }}
            >
              <span className="h-3 w-3 rounded-sm border border-slate-200" style={{ background: color.value || "#1e293b" }} />
              {color.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CalloutRibbonDropdown({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((c) => !c)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-medium transition-colors",
          editor.isActive("callout") ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100",
          disabled && "cursor-not-allowed opacity-40",
        )}
        title="Callout Block"
      >
        <Info className="h-3.5 w-3.5" />
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {CALLOUT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                editor.chain().focus().toggleCallout({ type: type.value }).run();
                setOpen(false);
              }}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          ))}
          {editor.isActive("callout") ? (
            <>
              <div className="my-1 h-px bg-slate-100" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  editor.chain().focus().unsetCallout().run();
                  setOpen(false);
                }}
              >
                Remove Callout
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── PRIMITIVES ──────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "text-[#0d3b84] after:absolute after:bottom-0 after:left-1 after:right-1 after:h-[2px] after:rounded-full after:bg-[#0d3b84]"
          : "text-slate-500 hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function RibbonSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-0.5">{children}</div>
      <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</span>
    </div>
  );
}

function RibbonBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-md px-1 transition-colors",
        active ? "bg-slate-200 text-slate-950" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function RibbonDivider() {
  return <div className="mx-1.5 h-10 w-px self-center bg-slate-200" />;
}
