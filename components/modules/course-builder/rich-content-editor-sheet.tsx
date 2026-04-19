"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Code2,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minus,
  Minimize2,
  Pilcrow,
  Quote,
  Strikethrough,
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
  Type,
  Underline as UnderlineIcon,
  Youtube,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
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
};

export function RichContentEditorSheet({
  open,
  onOpenChange,
  initialHtml,
  onSave,
  courseId,
  disabled,
}: RichContentEditorSheetProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      TiptapPlaceholder.configure({ placeholder: "Start writing your content…" }),
      TiptapHighlight.configure({ multicolor: true }),
      TiptapColor,
      TiptapTextStyle,
      TiptapYoutube.configure({ width: 640, height: 360, HTMLAttributes: { class: "rounded-lg overflow-hidden" } }),
      CodeBlockLowlight.configure({ lowlight }),
      Callout,
    ],
    content: initialHtml || "<p></p>",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none focus:outline-none min-h-[400px] p-6",
      },
    },
  });

  useEffect(() => {
    if (editor && open) {
      editor.commands.setContent(initialHtml || "<p></p>");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText();
    onSave(html, text);
  }, [editor, onSave]);

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    if (linkUrl.trim()) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl.trim(), target: "_blank" })
        .run();
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, linkUrl]);

  const insertImage = useCallback(async () => {
    if (!editor) return;

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
          editor.chain().focus().setImage({ src: uploadedUrl }).run();
        } else {
          // fall back to URL if upload fails
          if (imageUrl.trim()) {
            editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
          }
        }
      } catch {
        if (imageUrl.trim()) {
          editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
        }
      } finally {
        setIsUploadingImage(false);
      }
    } else if (imageUrl.trim()) {
      editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    }

    setImageDialogOpen(false);
    setImageUrl("");
    setImageFile(null);
  }, [editor, imageFile, imageUrl, courseId]);

  const insertYoutube = useCallback(() => {
    if (!editor || !youtubeUrl.trim()) return;
    editor.commands.setYoutubeVideo({ src: youtubeUrl.trim() });
    setYoutubeDialogOpen(false);
    setYoutubeUrl("");
  }, [editor, youtubeUrl]);

  if (!open) return null;

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-white"
    : "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[80vw] xl:w-[70vw]";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => onOpenChange(false)}
      />

      <div className={containerClass}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-[#0d3b84]" />
            <h2 className="text-sm font-semibold text-slate-900">Rich Content Editor</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg"
              onClick={handleSave}
              disabled={disabled}
            >
              Save Content
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        {editor && (
          <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white px-3 py-1.5">
            {/* Text formatting */}
            <ToolbarGroup>
              <ToolbarButton
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Underline"
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("code")}
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Inline Code"
              >
                <Code className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("highlight")}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                title="Highlight"
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-yellow-200 text-[9px] font-bold">H</span>
              </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            {/* Headings */}
            <ToolbarGroup>
              <ToolbarButton
                active={editor.isActive("paragraph")}
                onClick={() => editor.chain().focus().setParagraph().run()}
                title="Paragraph"
              >
                <Pilcrow className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("heading", { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
              >
                <Heading3 className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("heading", { level: 4 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                title="Heading 4"
              >
                <Heading4 className="h-3.5 w-3.5" />
              </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            {/* Lists & structure */}
            <ToolbarGroup>
              <ToolbarButton
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
              >
                <List className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Ordered List"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Blockquote"
              >
                <Quote className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
              >
                <Minus className="h-3.5 w-3.5" />
              </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            {/* Alignment */}
            <ToolbarGroup>
              <ToolbarButton
                active={editor.isActive({ textAlign: "left" })}
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                title="Align Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive({ textAlign: "center" })}
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                title="Align Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive({ textAlign: "right" })}
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                title="Align Right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            {/* Insert */}
            <ToolbarGroup>
              <ToolbarButton
                onClick={() => {
                  const currentLink = editor.getAttributes("link").href || "";
                  setLinkUrl(currentLink);
                  setLinkDialogOpen(true);
                }}
                active={editor.isActive("link")}
                title="Insert Link"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => setImageDialogOpen(true)}
                title="Insert Image"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
                title="Insert Table"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </ToolbarButton>
              {editor.isActive("table") && (
                <>
                  <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above">
                    <BetweenHorizontalStart className="h-3.5 w-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below">
                    <BetweenHorizontalEnd className="h-3.5 w-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Left">
                    <BetweenVerticalStart className="h-3.5 w-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column Right">
                    <BetweenVerticalEnd className="h-3.5 w-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                    <Rows className="h-3.5 w-3.5 text-red-500" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                    <Columns className="h-3.5 w-3.5 text-red-500" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">
                    <TableProperties className="h-3.5 w-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">
                    <RemoveFormatting className="h-3.5 w-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </ToolbarButton>
                </>
              )}
              <ToolbarButton
                active={editor.isActive("codeBlock")}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code Block"
              >
                <Code2 className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => setYoutubeDialogOpen(true)}
                title="Embed YouTube"
              >
                <Youtube className="h-3.5 w-3.5" />
              </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            {/* Callout */}
            <CalloutDropdown editor={editor} />
          </div>
        )}

        {/* Editor content */}
        <div className="flex-1 overflow-auto">
          <EditorContent editor={editor} />
          <style>{editorStyles}</style>
        </div>
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>Enter the URL for the link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={insertLink} disabled={!linkUrl.trim()}>Insert</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>Upload a file or enter a URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {courseId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Upload Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Or Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => { setImageDialogOpen(false); setImageFile(null); setImageUrl(""); }}>Cancel</Button>
            <Button
              className="rounded-xl"
              onClick={insertImage}
              disabled={isUploadingImage || (!imageFile && !imageUrl.trim())}
            >
              {isUploadingImage ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Insert
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* YouTube Dialog */}
      <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Embed YouTube Video</DialogTitle>
            <DialogDescription>Paste the YouTube video URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="rounded-xl"
            />
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

/* ---------- Toolbar primitives ---------- */

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-slate-200 text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
  return <div className="mx-1 h-5 w-px bg-slate-200" />;
}

function CalloutDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
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
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors",
          editor.isActive("callout")
            ? "bg-slate-200 text-slate-900"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        )}
        title="Callout Block"
      >
        <Info className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                editor.chain().focus().toggleCallout({ type: t.value }).run();
                setIsOpen(false);
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
          {editor.isActive("callout") && (
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
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Editor styles ---------- */

const editorStyles = `
  .ProseMirror {
    min-height: 400px;
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
