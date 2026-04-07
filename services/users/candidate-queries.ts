import { Prisma } from "@prisma/client";

import type { GetCandidateUsersInput } from "@/lib/validation-schemas/candidate-users";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { CandidateUserDetail, CandidateUsersResponse } from "@/types";
import {
  buildCandidateUserSelect,
  buildCandidateUserWhere,
  mapCandidateUser,
  mapCandidateUserDetail,
  type CandidateUserRecord,
} from "@/services/users/candidate-helpers";

export async function getCandidateUsersService(input: GetCandidateUsersInput): Promise<CandidateUsersResponse> {
  if (!isDatabaseConfigured) {
    return {
      items: [],
      totalCount: 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: 1,
    };
  }

  const sortMap: Record<GetCandidateUsersInput["sortBy"], Prisma.UserOrderByWithRelationInput> = {
    name: { name: input.sortDirection },
    email: { email: input.sortDirection },
    createdAt: { createdAt: input.sortDirection },
    lastLoginAt: { lastLoginAt: input.sortDirection },
  };

  const where = buildCandidateUserWhere({ search: input.search, status: input.status });

  const [totalCount, records] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: sortMap[input.sortBy],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: buildCandidateUserSelect(),
    }),
  ]);

  return {
    items: records.map((record) => mapCandidateUser(record as CandidateUserRecord)),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export async function getCandidateUserByIdService(userId: string): Promise<CandidateUserDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const record = await prisma.user.findFirst({
    where: {
      id: userId,
      ...buildCandidateUserWhere(),
    },
    select: buildCandidateUserSelect(),
  });

  return record ? mapCandidateUserDetail(record as CandidateUserRecord) : null;
}
