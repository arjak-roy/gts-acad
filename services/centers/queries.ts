import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MOCK_CENTERS, MOCK_CENTER_OPTIONS, MOCK_CITIES, MOCK_COUNTRIES, MOCK_STATES } from "@/services/centers/mock-data";
import { CenterDetail, CenterListItem, CenterSelectorOption, LocationOption } from "@/services/centers/types";

function buildAddressSummary(parts: Array<string | null | undefined>) {
  const resolvedParts = parts.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return resolvedParts.join(", ");
}

function mapCenterRecord(center: {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  landmark: string | null;
  postalCode: string | null;
  totalCapacity: number;
  currentUtilization: number;
  complianceStatus: string;
  isActive: boolean;
  location: {
    id: number;
    name: string;
    state: {
      id: number;
      name: string;
      country: {
        id: number;
        name: string;
      };
    };
  } | null;
  _count?: {
    batches: number;
  };
}): CenterDetail {
  const addressSummary = buildAddressSummary([
    center.addressLine1,
    center.addressLine2,
    center.landmark,
    center.location?.name,
    center.location?.state.name,
    center.location?.state.country.name,
    center.postalCode,
  ]);

  return {
    id: center.id,
    name: center.name,
    addressLine1: center.addressLine1,
    addressLine2: center.addressLine2,
    landmark: center.landmark,
    postalCode: center.postalCode,
    cityId: center.location?.id ?? null,
    stateId: center.location?.state.id ?? null,
    countryId: center.location?.state.country.id ?? null,
    cityName: center.location?.name ?? null,
    stateName: center.location?.state.name ?? null,
    countryName: center.location?.state.country.name ?? null,
    addressSummary,
    totalCapacity: center.totalCapacity,
    currentUtilization: center.currentUtilization,
    complianceStatus: (center.complianceStatus as CenterDetail["complianceStatus"]) ?? "pending",
    isActive: center.isActive,
    batchCount: center._count?.batches ?? 0,
  };
}

export async function listCentersService(): Promise<CenterListItem[]> {
  if (!isDatabaseConfigured) {
    return MOCK_CENTERS.map((center) => center);
  }

  const centers = await prisma.trainingCentre.findMany({
    include: {
      location: {
        include: {
          state: {
            include: {
              country: true,
            },
          },
        },
      },
      _count: {
        select: {
          batches: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return centers.map((center) => mapCenterRecord(center));
}

export async function getCenterByIdService(centerId: string): Promise<CenterDetail | null> {
  if (!isDatabaseConfigured) {
    return MOCK_CENTERS.find((center) => center.id === centerId) ?? null;
  }

  const center = await prisma.trainingCentre.findUnique({
    where: { id: centerId },
    include: {
      location: {
        include: {
          state: {
            include: {
              country: true,
            },
          },
        },
      },
      _count: {
        select: {
          batches: true,
        },
      },
    },
  });

  return center ? mapCenterRecord(center) : null;
}

export async function listCenterOptionsService(): Promise<CenterSelectorOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_CENTER_OPTIONS.filter((center) => center.isActive);
  }

  const centers = await prisma.trainingCentre.findMany({
    where: { isActive: true },
    include: {
      location: {
        include: {
          state: {
            include: {
              country: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return centers.map((center) => {
    const detail = mapCenterRecord(center);
    return {
      id: detail.id,
      name: detail.name,
      addressSummary: detail.addressSummary,
      isActive: detail.isActive,
    };
  });
}

export async function listCountriesService(): Promise<LocationOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_COUNTRIES;
  }

  return prisma.country.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function listStatesService(countryId?: number): Promise<LocationOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_STATES.filter((state) => (countryId ? state.countryId === countryId : true)).map(({ id, name }) => ({ id, name }));
  }

  return prisma.state.findMany({
    where: countryId ? { countryId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function listCitiesService(stateId?: number): Promise<LocationOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_CITIES.filter((city) => (stateId ? city.stateId === stateId : true)).map(({ id, name }) => ({ id, name }));
  }

  return prisma.city.findMany({
    where: stateId ? { stateId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}