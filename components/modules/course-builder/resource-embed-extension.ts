import { mergeAttributes, Node } from "@tiptap/core";

export type ResourceContentType = "article" | "document" | "video" | "link" | "file";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resourceEmbed: {
      setResourceEmbed: (attributes: { resourceId: string; resourceTitle: string; contentType: ResourceContentType }) => ReturnType;
    };
  }
}

const CONTENT_TYPE_ICONS: Record<ResourceContentType, string> = {
  article: "📄",
  document: "📑",
  video: "🎬",
  link: "🔗",
  file: "📎",
};

const CONTENT_TYPE_COLORS: Record<ResourceContentType, { bg: string; border: string; text: string }> = {
  article: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  document: { bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" },
  video: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  link: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  file: { bg: "#f8fafc", border: "#e2e8f0", text: "#334155" },
};

export const ResourceEmbed = Node.create({
  name: "resourceEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      resourceId: { default: null },
      resourceTitle: { default: "Untitled Resource" },
      contentType: { default: "article" as ResourceContentType },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-resource-embed]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const contentType = (node.attrs.contentType as ResourceContentType) || "article";
    const title = node.attrs.resourceTitle || "Untitled Resource";
    const icon = CONTENT_TYPE_ICONS[contentType] || CONTENT_TYPE_ICONS.article;
    const colors = CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.article;

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-resource-embed": node.attrs.resourceId,
        "data-content-type": contentType,
        style: `display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid ${colors.border}; border-radius: 10px; background: ${colors.bg}; margin: 8px 0; cursor: pointer; text-decoration: none;`,
      }),
      [
        "span",
        { style: "font-size: 1.3em; flex-shrink: 0;", contenteditable: "false" },
        icon,
      ],
      [
        "span",
        { style: `font-size: 0.875em; font-weight: 600; color: ${colors.text}; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` },
        title,
      ],
      [
        "span",
        { style: "font-size: 0.7em; color: #64748b; margin-left: auto; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.05em;", contenteditable: "false" },
        contentType,
      ],
    ];
  },

  addCommands() {
    return {
      setResourceEmbed:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});
