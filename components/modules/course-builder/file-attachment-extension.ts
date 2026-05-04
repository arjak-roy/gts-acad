import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attributes: { fileName: string; fileUrl: string; fileSize?: string; mimeType?: string }) => ReturnType;
    };
  }
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("application/pdf")) return "📕";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📘";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📗";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📙";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📎";
}

export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileName: { default: "file" },
      fileUrl: { default: "" },
      fileSize: { default: "" },
      mimeType: { default: "application/octet-stream" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-file-attachment]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const fileName = node.attrs.fileName || "file";
    const fileSize = node.attrs.fileSize || "";
    const mimeType = node.attrs.mimeType || "application/octet-stream";
    const icon = getFileIcon(mimeType);

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-file-attachment": node.attrs.fileUrl,
        "data-file-name": fileName,
        "data-mime-type": mimeType,
        style: "display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; margin: 8px 0;",
      }),
      [
        "span",
        { style: "font-size: 1.3em; flex-shrink: 0;", contenteditable: "false" },
        icon,
      ],
      [
        "span",
        { style: "font-size: 0.85em; font-weight: 600; color: #1e293b; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
        fileName,
      ],
      [
        "span",
        { style: "font-size: 0.7em; color: #94a3b8; margin-left: auto; flex-shrink: 0;", contenteditable: "false" },
        fileSize,
      ],
      [
        "a",
        {
          href: node.attrs.fileUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          download: fileName,
          style: "font-size: 0.75em; color: #0d3b84; text-decoration: none; font-weight: 600; flex-shrink: 0; margin-left: 8px;",
          contenteditable: "false",
        },
        "Download",
      ],
    ];
  },

  addCommands() {
    return {
      setFileAttachment:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});
