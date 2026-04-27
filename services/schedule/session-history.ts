import "server-only";

import { SessionHistoryAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";

// ── Types ──────────────────────────────────────────────────────

export type SessionHistoryEntry = {
  id: string;
  action: string;
  actorName: string | null;
  details: Prisma.JsonValue;
  createdAt: string;
};

// ── Logging ────────────────────────────────────────────────────

export async function logSessionEvent(
  scheduleEventId: string,
  action: SessionHistoryAction,
  actorUserId: string | null,
  details: Prisma.InputJsonValue = {},
) {
  return prisma.sessionHistory.create({
    data: {
      scheduleEventId,
      action,
      actorUserId,
      details,
    },
  });
}

// ── Queries ────────────────────────────────────────────────────

export async function getSessionHistory(scheduleEventId: string): Promise<SessionHistoryEntry[]> {
  const rows = await prisma.sessionHistory.findMany({
    where: { scheduleEventId },
    orderBy: { createdAt: "desc" },
    include: {
      actor: {
        select: { name: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor?.name ?? null,
    details: r.details,
    createdAt: r.createdAt.toISOString(),
  }));
}
