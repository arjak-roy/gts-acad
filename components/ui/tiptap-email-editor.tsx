"use client";

import { useCallback, useState } from "react";
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
  Code,
  Undo,
  Redo,
  Braces,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          style: "color: #0d3b84; text-decoration: underline;",
        },
      }),
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

  const handleSourceToggle = useCallback(() => {
    if (isSourceMode) {
      editor?.commands.setContent(sourceValue);
      onChange(sourceValue);
      setIsSourceMode(false);
    } else {
      setSourceValue(editor?.getHTML() ?? value);
      setIsSourceMode(true);
    }
  }, [isSourceMode, sourceValue, editor, onChange, value]);

  const handleSourceChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSourceValue(event.target.value);
    onChange(event.target.value);
  }, [onChange]);

  const insertPlaceholder = useCallback((variable: string) => {
    if (!editor) return;

    if (isSourceMode) {
      setSourceValue((prev) => `${prev}{{${variable}}}`);
      onChange(`${sourceValue}{{${variable}}}`);
    } else {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
  }, [editor, isSourceMode, onChange, sourceValue]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Link URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL:");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-xl border border-[#dde1e6] bg-white focus-within:ring-2 focus-within:ring-[#0d3b84] focus-within:ring-offset-1", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#dde1e6] px-2 py-1.5">
        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Media & structure */}
        <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="Insert link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="Insert image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addTable} title="Insert table">
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Source & history */}
        <ToolbarButton onClick={handleSourceToggle} active={isSourceMode} title="Toggle HTML source">
          <Braces className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Placeholder variable insertion */}
      {placeholderVariables && placeholderVariables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#dde1e6] px-3 py-2">
          <span className="text-xs font-medium text-slate-500">Insert:</span>
          {placeholderVariables.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => insertPlaceholder(variable)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
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
