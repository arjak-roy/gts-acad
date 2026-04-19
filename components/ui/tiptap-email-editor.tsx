"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  TableProperties,
  Columns,
  Rows,
  BetweenHorizontalStart,
  BetweenHorizontalEnd,
  BetweenVerticalStart,
  BetweenVerticalEnd,
  RemoveFormatting,
  Trash2,
  Code,
  Undo,
  Redo,
  Braces,
  Loader2,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EMAIL_LINK_STYLE = "color: #0d3b84; text-decoration: underline;";
const EMAIL_BUTTON_STYLE = [
  "display: inline-block",
  "padding: 12px 18px",
  "background: #0d3b84",
  "border-radius: 12px",
  "color: #ffffff",
  "font-size: 14px",
  "font-weight: 700",
  "line-height: 1.2",
  "text-decoration: none",
].join("; ");

const UNSUPPORTED_RICH_TEXT_TAG_PATTERN = /<(?:html|head|body|meta|title|div|span|colgroup|col)\b/i;
const HTML_CLASS_ATTRIBUTE_PATTERN = /<[a-z][\w:-]*\b[^>]*\sclass=(['"]).*?\1/i;
const HTML_STYLE_ATTRIBUTE_PATTERN = /<([a-z][\w:-]*)\b[^>]*\sstyle=(['"])(.*?)\2[^>]*>/gi;

function isSafeRichTextStyle(tagName: string, styleValue: string) {
  const normalizedTagName = tagName.toLowerCase();

  if (normalizedTagName === "a" || normalizedTagName === "img") {
    return true;
  }

  if (normalizedTagName === "p" || normalizedTagName === "h1" || normalizedTagName === "h2" || normalizedTagName === "h3") {
    const declarations = styleValue
      .split(";")
      .map((declaration) => declaration.trim().toLowerCase())
      .filter(Boolean);

    return declarations.length > 0 && declarations.every((declaration) => declaration.startsWith("text-align:"));
  }

  return false;
}

function containsAdvancedEmailHtml(source: string) {
  if (!source.trim()) {
    return false;
  }

  if (UNSUPPORTED_RICH_TEXT_TAG_PATTERN.test(source) || HTML_CLASS_ATTRIBUTE_PATTERN.test(source)) {
    return true;
  }

  HTML_STYLE_ATTRIBUTE_PATTERN.lastIndex = 0;

  for (let match = HTML_STYLE_ATTRIBUTE_PATTERN.exec(source); match; match = HTML_STYLE_ATTRIBUTE_PATTERN.exec(source)) {
    const tagName = match[1] ?? "";
    const styleValue = match[3] ?? "";

    if (!isSafeRichTextStyle(tagName, styleValue)) {
      return true;
    }
  }

  return false;
}

const EmailLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => attributes.style ? { style: attributes.style } : {},
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("title"),
        renderHTML: (attributes) => attributes.title ? { title: attributes.title } : {},
      },
    };
  },
}).configure({
  openOnClick: false,
  HTMLAttributes: {
    rel: "noopener noreferrer nofollow",
  },
});

type TipTapEmailEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  placeholderVariables?: string[];
  className?: string;
};

export function TipTapEmailEditor({ value, onChange, placeholder, placeholderVariables, className }: TipTapEmailEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const [allowUnsafeVisualEditing, setAllowUnsafeVisualEditing] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageAltInput, setImageAltInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isButtonDialogOpen, setIsButtonDialogOpen] = useState(false);
  const [buttonLabel, setButtonLabel] = useState("Call to action");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonAlignment, setButtonAlignment] = useState<"left" | "center" | "right">("left");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      EmailLink,
      Image.configure({
        HTMLAttributes: {
          style: "max-width: 100%; height: auto; border-radius: 8px;",
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: placeholder || "Start writing your email template...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value,
    onUpdate: ({ editor: updatedEditor }) => {
      const html = updatedEditor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[280px] px-4 py-3 focus:outline-none",
      },
    },
  });

  const containsAdvancedLayoutHtml = useMemo(() => containsAdvancedEmailHtml(value), [value]);

  useEffect(() => {
    setSourceValue(value);

    if (!editor || isSourceMode) {
      return;
    }

    const currentHtml = editor.getHTML();
    if (currentHtml !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, isSourceMode, value]);

  useEffect(() => {
    if (!containsAdvancedLayoutHtml && allowUnsafeVisualEditing) {
      setAllowUnsafeVisualEditing(false);
    }
  }, [allowUnsafeVisualEditing, containsAdvancedLayoutHtml]);

  useEffect(() => {
    if (containsAdvancedLayoutHtml && !allowUnsafeVisualEditing && !isSourceMode) {
      setSourceValue(value);
      setIsSourceMode(true);
    }
  }, [allowUnsafeVisualEditing, containsAdvancedLayoutHtml, isSourceMode, value]);

  const toolbarDisabled = isSourceMode;

  const canUndo = useMemo(() => !toolbarDisabled && editor?.can().undo(), [editor, toolbarDisabled]);
  const canRedo = useMemo(() => !toolbarDisabled && editor?.can().redo(), [editor, toolbarDisabled]);

  const handleSourceToggle = useCallback(() => {
    if (isSourceMode) {
      if (containsAdvancedLayoutHtml && !allowUnsafeVisualEditing) {
        const shouldSwitchToVisualMode = window.confirm(
          "This template contains advanced HTML and inline CSS. Visual editing can flatten the layout and strip those styles. Continue anyway?",
        );

        if (!shouldSwitchToVisualMode) {
          return;
        }

        setAllowUnsafeVisualEditing(true);
      }

      editor?.commands.setContent(sourceValue);
      onChange(sourceValue);
      setIsSourceMode(false);
    } else {
      setAllowUnsafeVisualEditing(false);
      setSourceValue(editor?.getHTML() ?? value);
      setIsSourceMode(true);
    }
  }, [allowUnsafeVisualEditing, containsAdvancedLayoutHtml, isSourceMode, sourceValue, editor, onChange, value]);

  const handleSourceChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSourceValue(event.target.value);
    onChange(event.target.value);
  }, [onChange]);

  const insertPlaceholder = useCallback((variable: string) => {
    if (!editor) return;

    if (isSourceMode) {
      setSourceValue((prev) => {
        const nextValue = `${prev}{{${variable}}}`;
        onChange(nextValue);
        return nextValue;
      });
    } else {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
  }, [editor, isSourceMode, onChange]);

  const normalizeHref = useCallback((rawValue: string) => {
    const normalized = rawValue.trim();
    if (!normalized) {
      return "";
    }

    if (/^(https?:|mailto:|tel:)/i.test(normalized)) {
      return normalized;
    }

    return `https://${normalized}`;
  }, []);

  const addLink = useCallback(() => {
    if (!editor || toolbarDisabled) return;
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Link URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setMark("link", { href: normalizeHref(url), style: EMAIL_LINK_STYLE }).run();
  }, [editor, normalizeHref, toolbarDisabled]);

  const resetImageDialog = useCallback(() => {
    setImageUrlInput("");
    setImageAltInput("");
    setImageFile(null);
    setIsUploadingImage(false);
  }, []);

  const openImageDialog = useCallback(() => {
    if (toolbarDisabled) {
      return;
    }

    resetImageDialog();
    setIsImageDialogOpen(true);
  }, [resetImageDialog, toolbarDisabled]);

  const handleInsertImage = useCallback(async () => {
    if (!editor) {
      return;
    }

    try {
      let nextImageUrl = imageUrlInput.trim();

      if (imageFile) {
        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append("file", imageFile);

        const response = await fetch("/api/email-templates/upload", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json().catch(() => null)) as { data?: { url?: string }; error?: string } | null;
        if (!response.ok || !payload?.data?.url) {
          throw new Error(payload?.error || "Unable to upload image.");
        }

        nextImageUrl = payload.data.url;
      }

      if (!nextImageUrl) {
        throw new Error("Provide an image URL or choose an image file to upload.");
      }

      editor.chain().focus().setImage({ src: nextImageUrl, alt: imageAltInput.trim() || undefined }).run();
      setIsImageDialogOpen(false);
      resetImageDialog();
      toast.success("Image inserted into the email template.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to insert image.");
    } finally {
      setIsUploadingImage(false);
    }
  }, [editor, imageAltInput, imageFile, imageUrlInput, resetImageDialog]);

  const resetButtonDialog = useCallback(() => {
    setButtonLabel("Call to action");
    setButtonUrl("");
    setButtonAlignment("left");
  }, []);

  const openButtonDialog = useCallback(() => {
    if (toolbarDisabled) {
      return;
    }

    resetButtonDialog();
    setIsButtonDialogOpen(true);
  }, [resetButtonDialog, toolbarDisabled]);

  const handleInsertButton = useCallback(() => {
    if (!editor) {
      return;
    }

    const href = normalizeHref(buttonUrl);
    const label = buttonLabel.trim();
    if (!href || !label) {
      toast.error("Button text and destination URL are required.");
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "paragraph",
        attrs: { textAlign: buttonAlignment },
        content: [
          {
            type: "text",
            text: label,
            marks: [
              {
                type: "link",
                attrs: {
                  href,
                  style: EMAIL_BUTTON_STYLE,
                },
              },
            ],
          },
        ],
      })
      .run();
    setIsButtonDialogOpen(false);
    resetButtonDialog();
  }, [buttonAlignment, buttonLabel, buttonUrl, editor, normalizeHref, resetButtonDialog]);

  const addTable = useCallback(() => {
    if (!editor || toolbarDisabled) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor, toolbarDisabled]);

  if (!editor) return null;

  return (
    <>
      <div className={cn("rounded-xl border border-[#dde1e6] bg-white focus-within:ring-2 focus-within:ring-[#0d3b84] focus-within:ring-offset-1", className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[#dde1e6] px-2 py-1.5">
        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" disabled={toolbarDisabled}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" disabled={toolbarDisabled}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" disabled={toolbarDisabled}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" disabled={toolbarDisabled}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1" disabled={toolbarDisabled}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2" disabled={toolbarDisabled}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3" disabled={toolbarDisabled}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left" disabled={toolbarDisabled}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center" disabled={toolbarDisabled}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right" disabled={toolbarDisabled}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list" disabled={toolbarDisabled}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list" disabled={toolbarDisabled}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote" disabled={toolbarDisabled}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule" disabled={toolbarDisabled}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Media & structure */}
        <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="Insert link" disabled={toolbarDisabled}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openImageDialog} title="Insert image" disabled={toolbarDisabled}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addTable} title="Insert table" disabled={toolbarDisabled}>
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive("table") && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above" disabled={toolbarDisabled}>
              <BetweenHorizontalStart className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below" disabled={toolbarDisabled}>
              <BetweenHorizontalEnd className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Left" disabled={toolbarDisabled}>
              <BetweenVerticalStart className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column Right" disabled={toolbarDisabled}>
              <BetweenVerticalEnd className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row" disabled={toolbarDisabled}>
              <Rows className="h-4 w-4 text-red-500" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column" disabled={toolbarDisabled}>
              <Columns className="h-4 w-4 text-red-500" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells" disabled={toolbarDisabled}>
              <TableProperties className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell" disabled={toolbarDisabled}>
              <RemoveFormatting className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table" disabled={toolbarDisabled}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </ToolbarButton>
          </>
        )}
        <ToolbarButton onClick={openButtonDialog} title="Insert CTA button" disabled={toolbarDisabled}>
          <span className="text-[11px] font-semibold">CTA</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block" disabled={toolbarDisabled}>
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Source & history */}
        <ToolbarButton onClick={handleSourceToggle} active={isSourceMode} title="Toggle HTML source">
          <Braces className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!canUndo} title="Undo">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!canRedo} title="Redo">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        </div>

        {containsAdvancedLayoutHtml ? (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {isSourceMode && !allowUnsafeVisualEditing
              ? "Advanced email HTML detected. HTML mode is preserving your inline CSS and wrapper layout."
              : "Visual editing is active on advanced email HTML. Further changes can simplify layout styling."}
          </div>
        ) : null}

        {/* Placeholder variable insertion */}
        {placeholderVariables && placeholderVariables.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#dde1e6] px-3 py-2">
            <span className="text-xs font-medium text-slate-500">Insert:</span>
            {placeholderVariables.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertPlaceholder(variable)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        )}

        {/* Editor content */}
        {isSourceMode ? (
          <textarea
            value={sourceValue}
            onChange={handleSourceChange}
            className="block w-full min-h-[280px] resize-y rounded-b-xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 focus:outline-none"
            spellCheck={false}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Inline Image</DialogTitle>
            <DialogDescription>Upload an image through the app or insert an existing hosted image URL.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hosted Image URL</label>
              <Input
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
                placeholder="https://cdn.example.com/newsletter/hero.png"
                disabled={isUploadingImage}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Upload Image</label>
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingImage}
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {imageFile ? <p className="text-xs text-slate-500">Selected: {imageFile.name}</p> : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Alt Text</label>
              <Input
                value={imageAltInput}
                onChange={(event) => setImageAltInput(event.target.value)}
                placeholder="Describe the image for accessibility"
                disabled={isUploadingImage}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsImageDialogOpen(false)} disabled={isUploadingImage}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleInsertImage()} disabled={isUploadingImage}>
              {isUploadingImage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : "Insert Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isButtonDialogOpen} onOpenChange={setIsButtonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert CTA Button</DialogTitle>
            <DialogDescription>Create an email-safe call-to-action button with inline styles.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Button Text</label>
              <Input value={buttonLabel} onChange={(event) => setButtonLabel(event.target.value)} placeholder="Open dashboard" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Destination URL</label>
              <Input value={buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} placeholder="https://gts-academy.app/dashboard" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Alignment</label>
              <select
                value={buttonAlignment}
                onChange={(event) => setButtonAlignment(event.target.value as "left" | "center" | "right")}
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsButtonDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertButton}>
              Insert Button
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ToolbarButton({ onClick, active, disabled, title, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
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
        "inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors",
        "hover:bg-slate-100 hover:text-slate-900",
        "disabled:opacity-40 disabled:pointer-events-none",
        active && "bg-slate-200 text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-5 w-px bg-slate-200" />;
}
