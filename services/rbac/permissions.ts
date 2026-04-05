import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

const SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";
const PERMISSION_CACHE_TTL_MS = 60_000;

type CachedPermissions = {
  permissions: string[];
  roleCodes: string[];
  fetchedAt: number;
};

const permissionCache = new Map<string, CachedPermissions>();

function isCacheValid(entry: CachedPermissions | undefined): entry is CachedPermissions {
  if (!entry) {
    return false;
  }

  return Date.now() - entry.fetchedAt < PERMISSION_CACHE_TTL_MS;
}

export function invalidateUserPermissionCache(userId: string) {
  permissionCache.delete(userId);
}

export function invalidateAllPermissionCaches() {
  permissionCache.clear();
}

async function fetchUserPermissionsFromDb(userId: string): Promise<CachedPermissions> {
  const rows = await prisma.$queryRaw<Array<{ permissionKey: string; roleCode: string }>>(
    Prisma.sql`
      SELECT DISTINCT
        p."key" AS "permissionKey",
        r."code" AS "roleCode"
      FROM "user_roles" ur
      INNER JOIN "roles" r ON r."role_id" = ur."role_id" AND r."is_active" = true
      INNER JOIN "role_permissions" rp ON rp."role_id" = r."role_id"
      INNER JOIN "permissions" p ON p."permission_id" = rp."permission_id"
      WHERE ur."user_id" = ${userId}::uuid
    `,
  );

  const roleCodeRows = await prisma.$queryRaw<Array<{ code: string }>>(
    Prisma.sql`
      SELECT DISTINCT r."code"
      FROM "user_roles" ur
      INNER JOIN "roles" r ON r."role_id" = ur."role_id" AND r."is_active" = true
      WHERE ur."user_id" = ${userId}::uuid
    `,
  );

  const permissions = [...new Set(rows.map((row) => row.permissionKey))];
  const roleCodes = roleCodeRows.map((row) => row.code);

  return {
    permissions,
    roleCodes,
    fetchedAt: Date.now(),
  };
}

export async function getUserPermissions(userId: string): Promise<{ permissions: string[]; roleCodes: string[] }> {
  if (!isDatabaseConfigured) {
    return { permissions: [], roleCodes: [] };
  }

  const cached = permissionCache.get(userId);
  if (isCacheValid(cached)) {
    return { permissions: cached.permissions, roleCodes: cached.roleCodes };
  }

  const fresh = await fetchUserPermissionsFromDb(userId);
  permissionCache.set(userId, fresh);

  return { permissions: fresh.permissions, roleCodes: fresh.roleCodes };
}

export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const { permissions, roleCodes } = await getUserPermissions(userId);

  if (roleCodes.includes(SUPER_ADMIN_ROLE_CODE)) {
    return true;
  }

  return permissions.includes(permissionKey);
}

export async function hasAnyPermission(userId: string, permissionKeys: string[]): Promise<boolean> {
  const { permissions, roleCodes } = await getUserPermissions(userId);

  if (roleCodes.includes(SUPER_ADMIN_ROLE_CODE)) {
    return true;
  }

  return permissionKeys.some((key) => permissions.includes(key));
}

export async function getAllPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });

  const grouped: Record<string, Array<{ id: string; action: string; key: string; description: string | null }>> = {};

  for (const permission of permissions) {
    if (!grouped[permission.module]) {
      grouped[permission.module] = [];
    }

    grouped[permission.module].push({
      id: permission.id,
      action: permission.action,
      key: permission.key,
      description: permission.description,
    });
  }

  return { permissions, grouped };
}
