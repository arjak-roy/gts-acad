import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaSignature: string | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const expectedDelegateKeys = Prisma.dmmf.datamodel.models.map(
  ({ name }) => `${name.charAt(0).toLowerCase()}${name.slice(1)}`,
);

const currentSchemaSignature = [
  Prisma.dmmf.datamodel.models
    .map(({ name, fields }) => `${name}:${fields.map(({ name: fieldName }) => fieldName).join(",")}`)
    .join("|"),
  Prisma.dmmf.datamodel.enums
    .map(
      ({ name, values }) =>
        `${name}:${values.map(({ name: valueName, dbName }) => `${valueName}=${dbName ?? valueName}`).join(",")}`,
    )
    .join("|"),
].join("::");

function hasCurrentModelDelegates(client: PrismaClient) {
  const delegateContainer = client as unknown as Record<string, unknown>;
  return expectedDelegateKeys.every((key) => typeof delegateContainer[key] !== "undefined");
}

const cachedPrisma = globalForPrisma.prisma;
const cachedSchemaSignatureMatches = globalForPrisma.prismaSchemaSignature === currentSchemaSignature;
const shouldReuseCachedClient = cachedPrisma
  ? cachedSchemaSignatureMatches && hasCurrentModelDelegates(cachedPrisma)
  : false;

if (cachedPrisma && !shouldReuseCachedClient) {
  void cachedPrisma.$disconnect().catch(() => undefined);
}

export const prisma = shouldReuseCachedClient && cachedPrisma
  ? cachedPrisma
  : createPrismaClient();

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = currentSchemaSignature;
}