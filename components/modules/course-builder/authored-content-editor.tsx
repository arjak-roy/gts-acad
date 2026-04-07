"use client";

import type { AuthoredContentBlock, AuthoredContentDocument } from "@/lib/authored-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function buildBlockId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createBlock(type: AuthoredContentBlock["type"]): AuthoredContentBlock {
  switch (type) {
    case "HEADING":
      return { id: buildBlockId("heading"), type: "HEADING", level: 2, text: "New section heading" };
    case "IMAGE":
      return {
        id: buildBlockId("image"),
        type: "IMAGE",
        imageUrl: "https://",
        altText: "Describe this image",
        caption: "",
      };
    case "BULLET_LIST":
      return { id: buildBlockId("list"), type: "BULLET_LIST", items: ["New list item"] };
    default:
      return { id: buildBlockId("paragraph"), type: "PARAGRAPH", text: "New paragraph" };
  }
}

export function AuthoredContentEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: AuthoredContentDocument;
  onChange: (nextValue: AuthoredContentDocument) => void;
  disabled?: boolean;
}) {
  function updateBlock(blockId: string, nextBlock: AuthoredContentBlock) {
    onChange({
      ...value,
      blocks: value.blocks.map((block) => (block.id === blockId ? nextBlock : block)),
    });
  }

  function removeBlock(blockId: string) {
    onChange({
      ...value,
      blocks: value.blocks.filter((block) => block.id !== blockId),
    });
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    const currentIndex = value.blocks.findIndex((block) => block.id === blockId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= value.blocks.length) {
      return;
    }

    const nextBlocks = [...value.blocks];
    const [movedBlock] = nextBlocks.splice(currentIndex, 1);
    nextBlocks.splice(nextIndex, 0, movedBlock);

    onChange({
      ...value,
      blocks: nextBlocks,
    });
  }

  function addBlock(type: AuthoredContentBlock["type"]) {
    onChange({
      ...value,
      blocks: [...value.blocks, createBlock(type)],
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Authored Lesson Blocks</p>
          <p className="mt-1 text-xs text-slate-500">Build learner-facing content with text, image, and list blocks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => addBlock("HEADING")}>Add heading</Button>
          <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => addBlock("PARAGRAPH")}>Add paragraph</Button>
          <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => addBlock("IMAGE")}>Add image</Button>
          <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => addBlock("BULLET_LIST")}>Add list</Button>
        </div>
      </div>

      <div className="space-y-3">
        {value.blocks.map((block, index) => (
          <div key={block.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{block.type.replace(/_/g, " ")} {index + 1}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={disabled || index === 0} onClick={() => moveBlock(block.id, -1)}>Up</Button>
                <Button type="button" size="sm" variant="ghost" disabled={disabled || index === value.blocks.length - 1} onClick={() => moveBlock(block.id, 1)}>Down</Button>
                <Button type="button" size="sm" variant="ghost" disabled={disabled || value.blocks.length === 1} onClick={() => removeBlock(block.id)}>Remove</Button>
              </div>
            </div>

            {block.type === "HEADING" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Level</label>
                  <select
                    value={block.level}
                    disabled={disabled}
                    onChange={(event) => updateBlock(block.id, { ...block, level: Number(event.target.value) as 2 | 3 | 4 })}
                    className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                  >
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                    <option value={4}>H4</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Heading text</label>
                  <Input value={block.text} disabled={disabled} onChange={(event) => updateBlock(block.id, { ...block, text: event.target.value })} />
                </div>
              </div>
            ) : null}

            {block.type === "PARAGRAPH" ? (
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium text-slate-600">Paragraph text</label>
                <textarea
                  rows={5}
                  disabled={disabled}
                  value={block.text}
                  onChange={(event) => updateBlock(block.id, { ...block, text: event.target.value })}
                  className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                />
              </div>
            ) : null}

            {block.type === "IMAGE" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Image URL</label>
                  <Input value={block.imageUrl} disabled={disabled} onChange={(event) => updateBlock(block.id, { ...block, imageUrl: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Alt text</label>
                  <Input value={block.altText} disabled={disabled} onChange={(event) => updateBlock(block.id, { ...block, altText: event.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Caption</label>
                  <Input value={block.caption} disabled={disabled} onChange={(event) => updateBlock(block.id, { ...block, caption: event.target.value })} />
                </div>
              </div>
            ) : null}

            {block.type === "BULLET_LIST" ? (
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium text-slate-600">List items</label>
                <textarea
                  rows={5}
                  disabled={disabled}
                  value={block.items.join("\n")}
                  onChange={(event) => updateBlock(block.id, {
                    ...block,
                    items: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                  })}
                  className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                />
                <p className="text-xs text-slate-500">Use one line per bullet item.</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}