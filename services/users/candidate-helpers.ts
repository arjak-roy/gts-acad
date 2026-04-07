import { Prisma } from "@prisma/client";

import type { GetCandidateUsersInput } from "@/lib/validation-schemas/candidate-users";
import type {
  CandidateUserDetail,
  CandidateUserListItem,
  InternalUserRoleInfo,
  WelcomeEmailStatus,
} from "@/types";

const CANDIDATE_ROLE_CODE = "CANDIDATE";

type CandidateUserMetadata = Record<string, unknown> & {
  accountType?: string;
  createdFrom?: string;
  requiresPasswordReset?: boolean;
  learnerCode?: string;
  welcomeCredentialsEmailStatus?: WelcomeEmailStatus;
  welcomeCredentialsLastIssuedAt?: string;
  welcomeCredentialsLastSentAt?: string;
  welcomeCredentialsFailureReason?: string | null;
};

type UserRoleRecord = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
};

export type CandidateUserRecord = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Prisma.JsonValue;
  roleAssignments: Array<{
    role: UserRoleRecord;
  }>;
  learnerAccount: {
    learnerCode: string;
    enrollments: Array<{
      batch: {
        code: string;
        program: {
          name: string;
        };
      };
    }>;
  } | null;
};

export function getMetadataRecord(value: Prisma.JsonValue): CandidateUserMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as CandidateUserMetadata;
}

export function mergeMetadata(existingValue: Prisma.JsonValue, patch: Partial<CandidateUserMetadata>) {
  return {
    ...getMetadataRecord(existingValue),
    ...patch,
  } satisfies CandidateUserMetadata;
}

function getWelcomeEmailStatus(metadataValue: Prisma.JsonValue): WelcomeEmailStatus {
  const metadata = getMetadataRecord(metadataValue);
  const status = metadata.welcomeCredentialsEmailStatus;
  if (status === "pending" || status === "sent" || status === "failed") {
    return status;
  }
  return "not_requested";
}

function getRequiresPasswordReset(metadataValue: Prisma.JsonValue) {
  const metadata = getMetadataRecord(metadataValue);
  return metadata.requiresPasswordReset === true;
}

function sortRoles(roles: InternalUserRoleInfo[]) {
  return [...roles].sort((left, right) => {
    if (left.isSystemRole !== right.isSystemRole) {
      return left.isSystemRole ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function mapRoleRecord(role: UserRoleRecord): InternalUserRoleInfo {
  return {
    id: role.id,
    name: role.name,
    code: role.code,
    isSystemRole: role.isSystemRole,
  };
}

export function mapCandidateUser(record: CandidateUserRecord): CandidateUserListItem {
  const roles = sortRoles(record.roleAssignments.map((a) => mapRoleRecord(a.role)));
  const activeEnrollment = record.learnerAccount?.enrollments?.[0] ?? null;

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    isActive: record.isActive,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    roles,
    primaryRoleCode: roles[0]?.code ?? null,
    onboardingStatus: getWelcomeEmailStatus(record.metadata),
    requiresPasswordReset: getRequiresPasswordReset(record.metadata),
    learnerCode: record.learnerAccount?.learnerCode ?? null,
    programName: activeEnrollment?.batch.program.name ?? null,
    batchCode: activeEnrollment?.batch.code ?? null,
  };
}

export function mapCandidateUserDetail(record: CandidateUserRecord): CandidateUserDetail {
  return {
    ...mapCandidateUser(record),
    metadata: getMetadataRecord(record.metadata),
  };
}

export function buildCandidateUserSelect() {
  return {
    id: true,
    email: true,
    name: true,
    phone: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    metadata: true,
    roleAssignments: {
      select: {
        role: {
          select: {
            id: true,
            name: true,
            code: true,
            isSystemRole: true,
          },
        },
      },
    },
    learnerAccount: {
      select: {
        learnerCode: true,
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" as const },
          take: 1,
          select: {
            batch: {
              select: {
                code: true,
                program: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

export function buildCandidateUserWhere(input?: {
  search?: string;
  status?: GetCandidateUsersInput["status"];
}): Prisma.UserWhereInput {
  return {
    roleAssignments: {
      some: {
        role: {
          code: CANDIDATE_ROLE_CODE,
        },
      },
    },
    ...(input?.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
            { phone: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(input?.status === "ACTIVE" ? { isActive: true } : {}),
    ...(input?.status === "INACTIVE" ? { isActive: false } : {}),
  };
}
