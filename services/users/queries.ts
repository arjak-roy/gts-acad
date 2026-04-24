import { Prisma } from "@prisma/client";

import type { GetUsersInput } from "@/lib/validation-schemas/users";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { InternalUserDetail, InternalUserRoleInfo, InternalUsersResponse } from "@/types";
import {
  buildInternalUserSelect,
  buildInternalUserWhere,
  getInternalUserRecord,
  mapInternalUser,
  mapInternalUserDetail,
  type UserRecord,
} from "@/services/users/internal-helpers";

export async function getUsersService(input: GetUsersInput): Promise<InternalUsersResponse> {
  if (!isDatabaseConfigured) {
    return {
      items: [],
      totalCount: 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: 1,
    };
  }

  const sortMap: Record<GetUsersInput["sortBy"], Prisma.UserOrderByWithRelationInput> = {
    name: { name: input.sortDirection },
    email: { email: input.sortDirection },
    createdAt: { createdAt: input.sortDirection },
    lastLoginAt: { lastLoginAt: input.sortDirection },
    status: { isActive: input.sortDirection },
  };

  const where = buildInternalUserWhere({ search: input.search, status: input.status });

  const [totalCount, records] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: sortMap[input.sortBy],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: buildInternalUserSelect(),
    }),
  ]);

  return {
    items: records.map((record) => mapInternalUser(record as UserRecord)),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export type UserSearchItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
};

export async function searchUsersService(query: string, limit: number): Promise<UserSearchItem[]> {
  if (!isDatabaseConfigured) return [];

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
    }));
  } catch (error) {
    console.warn("User search fallback activated", error);
    return [];
  }
}

export async function getUserByIdService(userId: string): Promise<InternalUserDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const record = await getInternalUserRecord(userId);
  return record ? mapInternalUserDetail(record as UserRecord) : null;
}

export async function getInternalUserRolesService(userId: string): Promise<InternalUserRoleInfo[]> {
  const user = await getUserByIdService(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  return user.roles;
}