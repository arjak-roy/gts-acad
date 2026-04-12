import { prisma } from "@/lib/prisma-client";

export const prismaWithLogs = prisma as unknown as {
  auditLog: {
    create: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  };
  emailLog: {
    create: (args: unknown) => Promise<{ id: string }>;
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    update: (args: unknown) => Promise<Record<string, unknown>>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  $transaction: <T extends unknown[]>(operations: { [K in keyof T]: Promise<T[K]> }) => Promise<T>;
};
