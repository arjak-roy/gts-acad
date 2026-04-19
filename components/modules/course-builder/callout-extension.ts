import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

export type CalloutType = "info" | "warning" | "tip" | "danger";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

const CALLOUT_ICONS: Record<CalloutType, string> = {
  info: "ℹ️",
  warning: "⚠️",
  tip: "💡",
  danger: "🚨",
};

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info" as CalloutType,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-callout-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout-type]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const calloutType = (node.attrs.type as CalloutType) || "info";
    const icon = CALLOUT_ICONS[calloutType] || CALLOUT_ICONS.info;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: `callout callout-${calloutType}`,
        "data-callout-type": calloutType,
        style: getCalloutStyle(calloutType),
      }),
      ["span", { class: "callout-icon", contenteditable: "false", style: "margin-right: 8px; user-select: none;" }, icon],
      ["div", { class: "callout-content", style: "flex: 1; min-width: 0;" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attributes),
      toggleCallout:
        (attributes) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attributes),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^:::info\s$/,
        type: this.type,
        getAttributes: () => ({ type: "info" }),
      }),
      wrappingInputRule({
        find: /^:::warning\s$/,
        type: this.type,
        getAttributes: () => ({ type: "warning" }),
      }),
      wrappingInputRule({
        find: /^:::tip\s$/,
        type: this.type,
        getAttributes: () => ({ type: "tip" }),
      }),
      wrappingInputRule({
        find: /^:::danger\s$/,
        type: this.type,
        getAttributes: () => ({ type: "danger" }),
      }),
    ];
  },
});

function getCalloutStyle(type: CalloutType): string {
  const styles: Record<CalloutType, string> = {
    info: "background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 8px; margin: 8px 0; display: flex; align-items: flex-start;",
    warning: "background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin: 8px 0; display: flex; align-items: flex-start;",
    tip: "background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 8px; margin: 8px 0; display: flex; align-items: flex-start;",
    danger: "background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin: 8px 0; display: flex; align-items: flex-start;",
  };
  return styles[type] || styles.info;
}
