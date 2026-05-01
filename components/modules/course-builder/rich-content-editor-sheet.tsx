"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code,
  Code2,
  Columns,
  Eye,
  FileText,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  PencilLine,
  Quote,
  Redo,
  RemoveFormatting,
  Rows,
  Sparkles,
  Strikethrough,
  Table as TableIcon,
  TableProperties,
  Trash2,
  Underline as UnderlineIcon,
  Undo,
  Youtube,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapUnderline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import { Table as TiptapTable } from "@tiptap/extension-table";
import TiptapTableRow from "@tiptap/extension-table-row";
import TiptapTableCell from "@tiptap/extension-table-cell";
import TiptapTableHeader from "@tiptap/extension-table-header";
import TiptapTextAlign from "@tiptap/extension-text-align";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import TiptapHighlight from "@tiptap/extension-highlight";
import TiptapColor from "@tiptap/extension-color";
import { TextStyle as TiptapTextStyle } from "@tiptap/extension-text-style";
import TiptapYoutube from "@tiptap/extension-youtube";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

import { Callout, type CalloutType } from "@/components/modules/course-builder/callout-extension";
import { convertV1ToHtml, getLmsLessonBlueprints } from "@/lib/authored-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const lowlight = createLowlight(common);

type RichContentEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHtml: string;
  onSave: (html: string, plainText: string) => void;
  courseId?: string;
  disabled?: boolean;
  draftStorageKey?: string;
  draftLabel?: string;
};

type StoredLessonStudioDraft = {
  html: string;
  updatedAt: string;
};

type StudioMode = "write" | "split" | "preview";

type OutlineItem = {
  id: string;
  level: number;
  text: string;
  position: number;
};

type ReadinessItem = {
  id: string;
  tone: "positive" | "warning";
  title: string;
  detail: string;
};

type QuickInsert = {
  id: string;
  label: string;
  description: string;
  run: (editor: Editor) => void;
};

const EMPTY_EDITOR_HTML = "<p></p>";

const QUICK_INSERTS: QuickInsert[] = [
  {
    id: "learning-outcome",
    label: "Learning Outcome",
    description: "Add a section that clarifies what the learner should be able to do.",
    run: (editor) => {
      editor.chain().focus().insertContent("<h2>Learning outcome</h2><p>By the end of this lesson, learners will be able to...</p>").run();
    },
  },
  {
    id: "worked-example",
    label: "Worked Example",
    description: "Create a guided example with space to explain each step.",
    run: (editor) => {
      editor.chain().focus().insertContent("<h3>Worked example</h3><p>Walk through a realistic example and explain the key decisions clearly.</p>").run();
    },
  },
  {
    id: "practice-task",
    label: "Practice Task",
    description: "Prompt the learner to apply the concept immediately.",
    run: (editor) => {
      editor.chain().focus().insertContent("<h3>Practice task</h3><ul><li>Task step 1</li><li>Task step 2</li><li>Success check</li></ul>").run();
    },
  },
  {
    id: "reflection",
    label: "Reflection Prompt",
    description: "Add a reflective question block to close a lesson section.",
    run: (editor) => {
      editor.chain().focus().insertContent("<blockquote><p>Reflection prompt: What changed in your approach after completing this lesson?</p></blockquote>").run();
    },
  },
  {
    id: "compare-table",
    label: "Comparison Table",
    description: "Insert a starter table for compare-and-contrast explanations.",
    run: (editor) => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
];

export function RichContentEditorSheet({
  open,
  onOpenChange,
  initialHtml,
  onSave,
  courseId,
  disabled,
  draftStorageKey,
  draftLabel = "lesson",
}: RichContentEditorSheetProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [studioMode, setStudioMode] = useState<StudioMode>("split");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAltText, setImageAltText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [savedHtml, setSavedHtml] = useState(initialHtml || EMPTY_EDITOR_HTML);
  const [recoveredDraftAt, setRecoveredDraftAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readStoredDraft = useCallback(() => {
    if (!draftStorageKey || typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as StoredLessonStudioDraft | null;
      if (!parsed || typeof parsed.html !== "string" || typeof parsed.updatedAt !== "string") {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }, [draftStorageKey]);

  const clearStoredDraft = useCallback(() => {
    if (!draftStorageKey || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore localStorage errors
    }
  }, [draftStorageKey]);

  const lessonBlueprints = useMemo(
    () => getLmsLessonBlueprints().map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      html: convertV1ToHtml(item.document),
    })),
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
      }),
      TiptapUnderline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-[#0d3b84] underline" },
      }),
      TiptapImage.configure({
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto" },
      }),
      TiptapTable.configure({ resizable: true }),
      TiptapTableRow,
      TiptapTableCell,
      TiptapTableHeader,
      TiptapTextAlign.configure({ types: ["heading", "paragraph"] }),
      TiptapPlaceholder.configure({ placeholder: "Start writing your lesson content..." }),
      TiptapHighlight.configure({ multicolor: true }),
      TiptapColor,
      TiptapTextStyle,
      TiptapYoutube.configure({ width: 640, height: 360, HTMLAttributes: { class: "rounded-lg overflow-hidden" } }),
      CodeBlockLowlight.configure({ lowlight }),
      Callout,
    ],
    content: initialHtml || EMPTY_EDITOR_HTML,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none focus:outline-none min-h-[460px] p-6",
      },
    },
  });

  useEffect(() => {
    if (editor && open) {
      const nextHtml = initialHtml || EMPTY_EDITOR_HTML;
      const storedDraft = readStoredDraft();
      const recoveredHtml = storedDraft && normalizeHtml(storedDraft.html) !== normalizeHtml(nextHtml)
        ? storedDraft.html
        : nextHtml;

      editor.commands.setContent(recoveredHtml);
      setSavedHtml(nextHtml);
      setStudioMode("split");
      setRecoveredDraftAt(storedDraft && recoveredHtml === storedDraft.html ? storedDraft.updatedAt : null);
    }
  }, [editor, initialHtml, open, readStoredDraft]);

  useEffect(() => {
    if (!editor || !open || !draftStorageKey || disabled || typeof window === "undefined") {
      return undefined;
    }

    const persistDraft = () => {
      try {
        const html = editor.getHTML();
        if (normalizeHtml(html) === normalizeHtml(savedHtml)) {
          window.localStorage.removeItem(draftStorageKey);
          return;
        }

        const payload: StoredLessonStudioDraft = {
          html,
          updatedAt: new Date().toISOString(),
        };

        window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      } catch {
        // ignore localStorage errors
      }
    };

    persistDraft();
    editor.on("update", persistDraft);
    return () => {
      editor.off("update", persistDraft);
    };
  }, [disabled, draftStorageKey, editor, open, savedHtml]);

  const requestClose = useCallback(() => {
    if (!editor) {
      onOpenChange(false);
      return;
    }

    const hasUnsavedChanges = normalizeHtml(editor.getHTML()) !== normalizeHtml(savedHtml);
    if (hasUnsavedChanges && !disabled && !window.confirm("Discard your unsaved lesson changes?")) {
      return;
    }

    onOpenChange(false);
  }, [disabled, editor, onOpenChange, savedHtml]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText();
    onSave(html, text);
    setSavedHtml(html);
    setRecoveredDraftAt(null);
    clearStoredDraft();
  }, [clearStoredDraft, editor, onSave]);

  useEffect(() => {
    if (!open || disabled) {
      return undefined;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [disabled, handleSave, open]);

  const applyBlueprint = useCallback((blueprintHtml: string) => {
    if (!editor) return;

    const hasMeaningfulContent = editor.getText().trim().length > 0 && normalizeHtml(editor.getHTML()) !== normalizeHtml(EMPTY_EDITOR_HTML);
    if (hasMeaningfulContent && !window.confirm("Replace the current draft with this lesson blueprint?")) {
      return;
    }

    editor.commands.setContent(blueprintHtml);
  }, [editor]);

  const discardToLastSaved = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(savedHtml || EMPTY_EDITOR_HTML);
    setRecoveredDraftAt(null);
    clearStoredDraft();
  }, [clearStoredDraft, editor, savedHtml]);

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: linkUrl.trim(), target: "_blank" })
      .run();
    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const insertImage = useCallback(async () => {
    if (!editor) return;

    const alt = imageAltText.trim() || undefined;

    if (imageFile && courseId) {
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("courseId", courseId);
        const res = await fetch("/api/course-content/upload", { method: "POST", body: formData });
        const json = await res.json();
        const uploadedUrl = json.data?.items?.[0]?.fileUrl ?? json.data?.fileUrl;
        if (res.ok && uploadedUrl) {
          editor.chain().focus().setImage({ src: uploadedUrl, alt }).run();
        } else if (imageUrl.trim()) {
          editor.chain().focus().setImage({ src: imageUrl.trim(), alt }).run();
        }
      } catch {
        if (imageUrl.trim()) {
          editor.chain().focus().setImage({ src: imageUrl.trim(), alt }).run();
        }
      } finally {
        setIsUploadingImage(false);
      }
    } else if (imageUrl.trim()) {
      editor.chain().focus().setImage({ src: imageUrl.trim(), alt }).run();
    }

    setImageDialogOpen(false);
    setImageUrl("");
    setImageAltText("");
    setImageFile(null);
  }, [courseId, editor, imageAltText, imageFile, imageUrl]);

  const insertYoutube = useCallback(() => {
    if (!editor || !youtubeUrl.trim()) return;
    editor.commands.setYoutubeVideo({ src: youtubeUrl.trim() });
    setYoutubeDialogOpen(false);
    setYoutubeUrl("");
  }, [editor, youtubeUrl]);

  if (!open) return null;

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-white"
    : "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[92vw] xl:w-[86vw]";

  const currentHtml = editor?.getHTML() ?? savedHtml;
  const currentPlainText = editor?.getText() ?? "";
  const wordCount = countWords(currentPlainText);
  const estimatedReadingMinutes = Math.max(1, Math.ceil(Math.max(wordCount, 1) / 180));
  const outline = editor ? buildLessonOutline(editor) : [];
  const readinessItems = buildReadinessItems(currentHtml, currentPlainText, outline);
  const warningCount = readinessItems.filter((item) => item.tone === "warning").length;
  const positiveCount = readinessItems.length - warningCount;
  const isDirty = normalizeHtml(currentHtml) !== normalizeHtml(savedHtml);
  const sanitizedPreviewHtml = currentHtml ? DOMPurify.sanitize(currentHtml) : "";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={requestClose} />

      <div className={containerClass}>
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0d3b84]/10 text-[#0d3b84]">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Lesson Studio</h2>
                  <p className="text-xs text-slate-500">Write, structure, preview, and quality-check learner-facing content in one workspace.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {recoveredDraftAt ? <Badge variant="warning">Recovered {draftLabel} draft</Badge> : null}
                <Badge variant={isDirty ? "warning" : "default"}>{isDirty ? "Unsaved changes" : "All changes saved"}</Badge>
                <Badge variant="info">{wordCount} words</Badge>
                <Badge variant="accent">{estimatedReadingMinutes} min read</Badge>
                <Badge variant="default">{outline.length} section{outline.length === 1 ? "" : "s"}</Badge>
                {warningCount > 0 ? <Badge variant="warning">{warningCount} review item{warningCount === 1 ? "" : "s"}</Badge> : null}
              </div>
              {recoveredDraftAt ? (
                <p className="text-xs text-amber-700">
                  Unsaved {draftLabel} changes from {formatTimestamp(recoveredDraftAt)} were restored from this device.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <ModeButton icon={<PencilLine className="h-3.5 w-3.5" />} active={studioMode === "write"} onClick={() => setStudioMode("write")} label="Write" />
                <ModeButton icon={<FileText className="h-3.5 w-3.5" />} active={studioMode === "split"} onClick={() => setStudioMode("split")} label="Split" />
                <ModeButton icon={<Eye className="h-3.5 w-3.5" />} active={studioMode === "preview"} onClick={() => setStudioMode("preview")} label="Preview" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isDirty ? (
                  <Button size="sm" variant="ghost" className="h-8 rounded-xl" onClick={discardToLastSaved} disabled={disabled}>
                    Reset Draft
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="h-8 rounded-xl" onClick={() => setIsFullscreen((current) => !current)}>
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="secondary" className="h-8 rounded-xl" onClick={requestClose}>
                  Cancel
                </Button>
                <Button size="sm" className="h-8 rounded-xl" onClick={handleSave} disabled={disabled}>
                  Save Content
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-slate-100/60">
          <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
            <aside className="hidden min-h-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Lesson Structure</p>
                <p className="mt-1 text-xs text-slate-500">Start from a blueprint, drop in key sections, and jump through the lesson outline.</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <RailSection
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Blueprints"
                  description="Replace the current draft with a guided lesson scaffold."
                >
                  <div className="space-y-2">
                    {lessonBlueprints.map((blueprint) => (
                      <button
                        key={blueprint.id}
                        type="button"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-colors hover:border-[#0d3b84]/30 hover:bg-[#0d3b84]/[0.04]"
                        onClick={() => applyBlueprint(blueprint.html)}
                        disabled={disabled}
                      >
                        <p className="text-sm font-semibold text-slate-900">{blueprint.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{blueprint.description}</p>
                      </button>
                    ))}
                  </div>
                </RailSection>

                <RailSection
                  icon={<ListChecks className="h-4 w-4" />}
                  title="Quick Inserts"
                  description="Add the blocks authors use most without rebuilding the structure by hand."
                >
                  <div className="space-y-2">
                    {QUICK_INSERTS.map((insert) => (
                      <button
                        key={insert.id}
                        type="button"
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => editor && insert.run(editor)}
                        disabled={disabled || !editor}
                      >
                        <p className="text-sm font-semibold text-slate-900">{insert.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{insert.description}</p>
                      </button>
                    ))}
                  </div>
                </RailSection>

                <RailSection
                  icon={<FileText className="h-4 w-4" />}
                  title="Outline"
                  description="Jump to existing sections and spot gaps before you save."
                >
                  {outline.length > 0 ? (
                    <div className="space-y-1.5">
                      {outline.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50"
                          onClick={() => editor?.chain().focus(item.position).run()}
                        >
                          <span className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">H{item.level}</span>
                          <span className="min-w-0 flex-1 text-sm text-slate-700">{item.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyNote>
                      Add at least one heading to generate a navigable lesson outline.
                    </EmptyNote>
                  )}
                </RailSection>
              </div>
            </aside>

            <main className={cn("min-h-0 overflow-hidden", studioMode === "preview" && "xl:border-r xl:border-slate-200")}>
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {QUICK_INSERTS.slice(0, 4).map((insert) => (
                      <Button
                        key={insert.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 shrink-0 rounded-xl"
                        onClick={() => editor && insert.run(editor)}
                        disabled={disabled || !editor}
                      >
                        {insert.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {studioMode !== "preview" ? (
                  <>
                    {editor ? (
                      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ToolbarLabel label="History" />
                          <ToolbarGroup>
                            <ToolbarButton active={false} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo">
                              <Undo className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={false} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo">
                              <Redo className="h-3.5 w-3.5" />
                            </ToolbarButton>
                          </ToolbarGroup>

                          <ToolbarDivider />

                          <ToolbarLabel label="Format" />
                          <ToolbarGroup>
                            <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
                              <Bold className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
                              <Italic className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
                              <UnderlineIcon className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
                              <Strikethrough className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code">
                              <Code className="h-3.5 w-3.5" />
                            </ToolbarButton>
                          </ToolbarGroup>

                          <ToolbarDivider />

                          <ToolbarLabel label="Structure" />
                          <ToolbarGroup>
                            <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
                              <Heading2 className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
                              <Heading3 className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">
                              <Heading4 className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
                              <List className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
                              <ListOrdered className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
                              <Quote className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
                              <Minus className="h-3.5 w-3.5" />
                            </ToolbarButton>
                          </ToolbarGroup>

                          <ToolbarDivider />

                          <ToolbarLabel label="Layout" />
                          <ToolbarGroup>
                            <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align Left">
                              <AlignLeft className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align Center">
                              <AlignCenter className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align Right">
                              <AlignRight className="h-3.5 w-3.5" />
                            </ToolbarButton>
                          </ToolbarGroup>

                          <ToolbarDivider />

                          <ToolbarLabel label="Insert" />
                          <ToolbarGroup>
                            <ToolbarButton
                              active={editor.isActive("link")}
                              onClick={() => {
                                const currentLink = editor.getAttributes("link").href || "";
                                setLinkUrl(currentLink);
                                setLinkDialogOpen(true);
                              }}
                              title="Insert Link"
                            >
                              <LinkIcon className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={false} onClick={() => setImageDialogOpen(true)} title="Insert Image">
                              <ImageIcon className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={editor.isActive("table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
                              <TableIcon className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            {editor.isActive("table") ? (
                              <>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above">
                                  <BetweenHorizontalStart className="h-3.5 w-3.5" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below">
                                  <BetweenHorizontalEnd className="h-3.5 w-3.5" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Left">
                                  <BetweenVerticalStart className="h-3.5 w-3.5" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column Right">
                                  <BetweenVerticalEnd className="h-3.5 w-3.5" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                                  <Rows className="h-3.5 w-3.5 text-rose-500" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                                  <Columns className="h-3.5 w-3.5 text-rose-500" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">
                                  <TableProperties className="h-3.5 w-3.5" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">
                                  <RemoveFormatting className="h-3.5 w-3.5" />
                                </ToolbarButton>
                                <ToolbarButton active={false} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                </ToolbarButton>
                              </>
                            ) : null}
                            <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
                              <Code2 className="h-3.5 w-3.5" />
                            </ToolbarButton>
                            <ToolbarButton active={false} onClick={() => setYoutubeDialogOpen(true)} title="Embed YouTube">
                              <Youtube className="h-3.5 w-3.5" />
                            </ToolbarButton>
                          </ToolbarGroup>

                          <ToolbarDivider />

                          <CalloutDropdown editor={editor} />
                        </div>
                      </div>
                    ) : null}

                    <div className="min-h-0 flex-1 overflow-auto px-4 py-4 xl:px-5">
                      <div className="mx-auto min-h-full w-full max-w-4xl rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <EditorContent editor={editor} />
                      </div>
                      <style>{editorStyles}</style>
                    </div>
                  </>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto px-4 py-4 xl:px-5">
                    <PreviewSurface html={sanitizedPreviewHtml} />
                  </div>
                )}
              </div>
            </main>

            <aside
              className={cn(
                "min-h-0 border-t border-slate-200 bg-white xl:border-l xl:border-t-0",
                studioMode === "write" ? "hidden xl:block" : "block",
              )}
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Preview & Quality</p>
                  <p className="mt-1 text-xs text-slate-500">Review what learners will see before you save or publish.</p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {studioMode !== "preview" ? (
                    <RailSection icon={<Eye className="h-4 w-4" />} title="Live Preview" description="Learner-facing rendering updates as you edit.">
                      <PreviewSurface html={sanitizedPreviewHtml} compact />
                    </RailSection>
                  ) : null}

                  <RailSection icon={<Clock3 className="h-4 w-4" />} title="Content Snapshot" description="Useful signals pulled from the current lesson body.">
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard label="Words" value={String(wordCount)} helper="Learner-facing body only" />
                      <StatCard label="Read time" value={`${estimatedReadingMinutes} min`} helper="Estimated from body text" />
                      <StatCard label="Sections" value={String(outline.length)} helper="Detected headings" />
                      <StatCard label="Images" value={String(countOccurrences(currentHtml, /<img\b/gi))} helper="Preview media count" />
                    </div>
                  </RailSection>

                  <RailSection icon={<CheckCircle2 className="h-4 w-4" />} title="Publish Readiness" description="Fix the warnings below before you move this lesson into delivery.">
                    <div className="space-y-2">
                      {readinessItems.map((item) => (
                        <ReadinessRow key={item.id} item={item} />
                      ))}
                      {readinessItems.length === 0 ? (
                        <EmptyNote>
                          Keep writing to generate publish checks for this lesson.
                        </EmptyNote>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={warningCount > 0 ? "warning" : "default"}>{warningCount} warning{warningCount === 1 ? "" : "s"}</Badge>
                      <Badge variant="default">{positiveCount} ready signal{positiveCount === 1 ? "" : "s"}</Badge>
                    </div>
                  </RailSection>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>Add a destination URL for the selected text or the next content you insert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" className="rounded-xl" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={insertLink} disabled={!linkUrl.trim()}>Insert</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>Upload a course asset or paste a hosted image URL. Add alt text now so the lesson is ready for review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {courseId ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Upload Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Or Image URL</label>
              <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.png" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Alt Text</label>
              <Input value={imageAltText} onChange={(event) => setImageAltText(event.target.value)} placeholder="Describe the image for accessibility" className="rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                setImageDialogOpen(false);
                setImageFile(null);
                setImageUrl("");
                setImageAltText("");
              }}
            >
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={() => void insertImage()} disabled={isUploadingImage || (!imageFile && !imageUrl.trim())}>
              {isUploadingImage ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Insert
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Embed YouTube Video</DialogTitle>
            <DialogDescription>Paste the YouTube URL you want the learner to watch inline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="rounded-xl" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setYoutubeDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={insertYoutube} disabled={!youtubeUrl.trim()}>Embed</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RailSection({
  children,
  description,
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-b border-slate-200 px-4 py-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 text-[#0d3b84]">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PreviewSurface({ html, compact = false }: { html: string; compact?: boolean }) {
  return html.trim().length > 0 && normalizeHtml(html) !== normalizeHtml(EMPTY_EDITOR_HTML) ? (
    <div className={cn("overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm", compact && "rounded-2xl")}>
      <div
        className={cn(
          "prose prose-slate max-w-none p-5 prose-headings:font-semibold prose-img:rounded-xl prose-li:marker:text-slate-500",
          compact && "max-h-[320px] overflow-y-auto p-4 prose-sm",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  ) : (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">
      The preview will appear here once the lesson has more than an empty paragraph.
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        item.tone === "warning"
          ? "border-amber-200 bg-amber-50/80"
          : "border-emerald-200 bg-emerald-50/70",
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn("mt-0.5", item.tone === "warning" ? "text-amber-700" : "text-emerald-700")}>
          {item.tone === "warning" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </div>
        <div>
          <p className={cn("text-sm font-semibold", item.tone === "warning" ? "text-amber-950" : "text-emerald-950")}>{item.title}</p>
          <p className={cn("mt-1 text-xs leading-5", item.tone === "warning" ? "text-amber-900/80" : "text-emerald-900/80")}>{item.detail}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-xs leading-5 text-slate-500">
      {children}
    </div>
  );
}

function ToolbarButton({
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
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active ? "bg-slate-200 text-slate-950" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-slate-200" />;
}

function ToolbarLabel({ label }: { label: string }) {
  return <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>;
}

function CalloutDropdown({ editor }: { editor: Editor | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!editor) return null;

  const types: { value: CalloutType; label: string; icon: string }[] = [
    { value: "info", label: "Info", icon: "ℹ️" },
    { value: "tip", label: "Tip", icon: "💡" },
    { value: "warning", label: "Warning", icon: "⚠️" },
    { value: "danger", label: "Danger", icon: "🚨" },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition-colors",
          editor.isActive("callout")
            ? "bg-slate-200 text-slate-900"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        )}
        title="Callout Block"
      >
        <Info className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-full z-10 mt-1 w-36 rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
          {types.map((type) => (
            <button
              key={type.value}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                editor.chain().focus().toggleCallout({ type: type.value }).run();
                setIsOpen(false);
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
                  setIsOpen(false);
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

function buildLessonOutline(editor: Editor): OutlineItem[] {
  const nextOutline: OutlineItem[] = [];

  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "heading") {
      return true;
    }

    const text = node.textContent.trim();
    if (!text) {
      return true;
    }

    nextOutline.push({
      id: `${position}-${node.attrs.level}`,
      level: typeof node.attrs.level === "number" ? node.attrs.level : 2,
      text,
      position,
    });

    return true;
  });

  return nextOutline;
}

function buildReadinessItems(html: string, plainText: string, outline: OutlineItem[]): ReadinessItem[] {
  if (!html.trim()) {
    return [];
  }

  const items: ReadinessItem[] = [];
  const wordCount = countWords(plainText);

  if (wordCount < 40) {
    items.push({
      id: "body-light",
      tone: "warning",
      title: "Lesson body is still thin",
      detail: "Add more instructional context so the learner can understand the concept without trainer intervention.",
    });
  } else {
    items.push({
      id: "body-depth",
      tone: "positive",
      title: "Body has meaningful lesson content",
      detail: "There is enough body text for a learner-facing reading flow to feel intentional.",
    });
  }

  if (outline.length === 0 && wordCount > 120) {
    items.push({
      id: "missing-headings",
      tone: "warning",
      title: "Add section headings",
      detail: "Longer lessons should use headings so curriculum previews and learner scanning stay readable.",
    });
  } else if (outline.length > 0) {
    items.push({
      id: "headings-present",
      tone: "positive",
      title: "Section structure is visible",
      detail: `The outline detects ${outline.length} heading${outline.length === 1 ? "" : "s"}, which helps learner navigation.`,
    });
  }

  if (typeof window !== "undefined") {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    const images = Array.from(document.querySelectorAll("img"));
    const missingAltCount = images.filter((image) => !(image.getAttribute("alt") || "").trim()).length;
    if (missingAltCount > 0) {
      items.push({
        id: "missing-alt",
        tone: "warning",
        title: "Add image alt text",
        detail: `${missingAltCount} image${missingAltCount === 1 ? " is" : "s are"} missing alt text. Add it now before content review.`,
      });
    } else if (images.length > 0) {
      items.push({
        id: "image-alt-complete",
        tone: "positive",
        title: "Image accessibility is covered",
        detail: `All ${images.length} image${images.length === 1 ? "" : "s"} include alt text.`,
      });
    }

    const anchors = Array.from(document.querySelectorAll("a"));
    const emptyLinks = anchors.filter((anchor) => !(anchor.getAttribute("href") || "").trim() || !anchor.textContent?.trim()).length;
    if (emptyLinks > 0) {
      items.push({
        id: "empty-links",
        tone: "warning",
        title: "Review incomplete links",
        detail: `${emptyLinks} link${emptyLinks === 1 ? " looks" : "s look"} incomplete because the destination or label is empty.`,
      });
    } else if (anchors.length > 0) {
      items.push({
        id: "links-valid",
        tone: "positive",
        title: "Links are present and labelled",
        detail: `All ${anchors.length} link${anchors.length === 1 ? "" : "s"} have a destination and visible label.`,
      });
    }

    const headings = Array.from(document.querySelectorAll("h2, h3, h4")).map((heading) => Number(heading.tagName.replace("H", "")));
    const hasJump = headings.some((level, index) => index > 0 && level - headings[index - 1] > 1);
    if (hasJump) {
      items.push({
        id: "heading-jump",
        tone: "warning",
        title: "Heading levels skip a step",
        detail: "Use a smoother heading hierarchy so learners do not drop from one structural depth to another unexpectedly.",
      });
    }

    const widestTable = Array.from(document.querySelectorAll("table")).reduce((maxColumns, table) => {
      const firstRow = table.querySelector("tr");
      return Math.max(maxColumns, firstRow ? firstRow.children.length : 0);
    }, 0);
    if (widestTable > 5) {
      items.push({
        id: "wide-table",
        tone: "warning",
        title: "Large table may not fit learner layouts",
        detail: `At least one table has ${widestTable} columns. Consider a simpler comparison or card layout for smaller screens.`,
      });
    }
  }

  return items;
}

function countOccurrences(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

function countWords(value: string) {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).filter(Boolean).length;
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "a recent session";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeHtml(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const editorStyles = `
  .ProseMirror {
    min-height: 460px;
  }
  .ProseMirror:focus {
    outline: none;
  }
  .ProseMirror h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: #0f172a;
  }
  .ProseMirror h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    color: #1e293b;
  }
  .ProseMirror h4 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.25rem;
    color: #334155;
  }
  .ProseMirror p {
    margin-bottom: 0.75rem;
    line-height: 1.7;
  }
  .ProseMirror ul {
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
    list-style-type: disc;
  }
  .ProseMirror ol {
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
    list-style-type: decimal;
  }
  .ProseMirror li {
    margin-bottom: 0.25rem;
  }
  .ProseMirror blockquote {
    border-left: 3px solid #cbd5e1;
    padding-left: 1rem;
    margin: 1rem 0;
    color: #64748b;
    font-style: italic;
  }
  .ProseMirror hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1.5rem 0;
  }
  .ProseMirror code {
    background: #f1f5f9;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    font-size: 0.85em;
    color: #be123c;
  }
  .ProseMirror pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1rem 0;
    font-size: 0.85rem;
    line-height: 1.6;
  }
  .ProseMirror pre code {
    background: none;
    color: inherit;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
  }
  .ProseMirror img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 1rem 0;
  }
  .ProseMirror a {
    color: #0d3b84;
    text-decoration: underline;
  }
  .ProseMirror table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
  }
  .ProseMirror th, .ProseMirror td {
    border: 1px solid #e2e8f0;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }
  .ProseMirror th {
    background: #f8fafc;
    font-weight: 600;
  }
  .ProseMirror mark {
    background: #fef08a;
    padding: 0.1rem 0.2rem;
    border-radius: 2px;
  }
  .ProseMirror .callout {
    display: flex;
    align-items: flex-start;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 8px 0;
  }
  .ProseMirror .callout-info {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
  }
  .ProseMirror .callout-warning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
  }
  .ProseMirror .callout-tip {
    background: #f0fdf4;
    border-left: 4px solid #22c55e;
  }
  .ProseMirror .callout-danger {
    background: #fef2f2;
    border-left: 4px solid #ef4444;
  }
  .ProseMirror .callout .callout-content p:last-child {
    margin-bottom: 0;
  }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #94a3b8;
    pointer-events: none;
    height: 0;
  }
  .ProseMirror iframe {
    border-radius: 8px;
    width: 100%;
    max-width: 640px;
  }
`;