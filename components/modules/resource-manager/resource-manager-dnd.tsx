"use client";

import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { FileText } from "lucide-react";

import { useResourceManager } from "./resource-manager-types";

type DragData = { type: "resource"; resourceId: string; title: string };

export function ResourceManagerDndWrapper({ children }: { children: React.ReactNode }) {
  const { moveResource } = useResourceManager();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data?.type === "resource") {
      setActiveDrag(data);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const data = event.active.data.current as DragData | undefined;
    if (!data || data.type !== "resource") return;

    const overId = event.over?.id as string | undefined;
    if (!overId) return;

    let targetFolderId: string | null = null;
    if (overId === "folder-root") {
      targetFolderId = null;
    } else if (overId.startsWith("folder-")) {
      targetFolderId = overId.replace("folder-", "");
    } else {
      return;
    }

    await moveResource(data.resourceId, targetFolderId);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <DragOverlay>
        {activeDrag && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-lg">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="max-w-[200px] truncate">{activeDrag.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
