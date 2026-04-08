import { AuditActionType, AuditEntityType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateCenterInput, UpdateCenterInput } from "@/lib/validation-schemas/centers";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { MOCK_CENTERS, MOCK_CITIES, MOCK_COUNTRIES, MOCK_STATES } from "@/services/centers/mock-data";
import { getCenterByIdService } from "@/services/centers/queries";
import { CenterCreateResult, CenterDetail } from "@/services/centers/types";

type CenterMutationOptions = {
  actorUserId?: string | null;
};

function buildMockCenterResult(input: {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  postalCode: string | null;
  countryId: number;
  stateId: number;
  cityId: number;
  totalCapacity: number;
  currentUtilization: number;
  complianceStatus: CenterDetail["complianceStatus"];
  isActive: boolean;
}): CenterDetail {
  const city = MOCK_CITIES.find((item) => item.id === input.cityId);
  const state = MOCK_STATES.find((item) => item.id === input.stateId);
  const country = MOCK_COUNTRIES.find((item) => item.id === input.countryId);
  const addressSummary = [
    input.addressLine1,
    input.addressLine2,
    input.landmark,
    city?.name,
    state?.name,
    country?.name,
    input.postalCode,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");

  return {
    id: input.id,
    name: input.name,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    landmark: input.landmark,
    postalCode: input.postalCode,
    countryId: input.countryId,
    stateId: input.stateId,
    cityId: input.cityId,
    countryName: country?.name ?? null,
    stateName: state?.name ?? null,
    cityName: city?.name ?? null,
    addressSummary,
    totalCapacity: input.totalCapacity,
    currentUtilization: input.currentUtilization,
    complianceStatus: input.complianceStatus,
    isActive: input.isActive,
    batchCount: 0,
  };
}

async function assertUniqueCenterName(name: string, centerId?: string) {
  const duplicate = await prisma.trainingCentre.findFirst({
    where: {
      id: centerId ? { not: centerId } : undefined,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("A center with this name already exists.");
  }
}

async function resolveLocationSelection(countryId: number, stateId: number, cityId: number) {
  const city = await prisma.city.findFirst({
    where: {
      id: cityId,
      stateId,
      state: {
        countryId,
      },
    },
    include: {
      state: {
        include: {
          country: true,
        },
      },
    },
  });

  if (!city) {
    throw new Error("Invalid location selection.");
  }

  return city;
}

export async function createCenterService(input: CreateCenterInput, options: CenterMutationOptions = {}): Promise<CenterCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedAddressLine1 = input.addressLine1.trim();
  const normalizedAddressLine2 = input.addressLine2.trim() || null;
  const normalizedLandmark = input.landmark.trim() || null;
  const normalizedPostalCode = input.postalCode.trim() || null;
  const isActive = input.status === "ACTIVE";

  if (!isDatabaseConfigured) {
    return buildMockCenterResult({
      id: `mock-center-${Date.now()}`,
      name: normalizedName,
      addressLine1: normalizedAddressLine1,
      addressLine2: normalizedAddressLine2,
      landmark: normalizedLandmark,
      postalCode: normalizedPostalCode,
      countryId: input.countryId,
      stateId: input.stateId,
      cityId: input.cityId,
      totalCapacity: input.totalCapacity,
      currentUtilization: input.currentUtilization,
      complianceStatus: input.complianceStatus,
      isActive,
    });
  }

  await assertUniqueCenterName(normalizedName);
  const city = await resolveLocationSelection(input.countryId, input.stateId, input.cityId);

  const center = await prisma.trainingCentre.create({
    data: {
      name: normalizedName,
      addressLine1: normalizedAddressLine1,
      addressLine2: normalizedAddressLine2,
      landmark: normalizedLandmark,
      postalCode: normalizedPostalCode,
      locationId: city.id,
      totalCapacity: input.totalCapacity,
      currentUtilization: input.currentUtilization,
      complianceStatus: input.complianceStatus,
      isActive,
      infrastructure: {},
    },
    select: {
      id: true,
    },
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: center.id,
    action: AuditActionType.CREATED,
    actorUserId: options.actorUserId ?? null,
    status: "CENTER",
    message: `Center ${normalizedName} created.`,
    metadata: {
      location: {
        city: city.name,
        state: city.state.name,
        country: city.state.country.name,
      },
      totalCapacity: input.totalCapacity,
      currentUtilization: input.currentUtilization,
      complianceStatus: input.complianceStatus,
      isActive,
    },
  });

  const detail = await getCenterByIdService(center.id);
  if (!detail) {
    throw new Error("Center not found after creation.");
  }

  return detail;
}

export async function updateCenterService(input: UpdateCenterInput, options: CenterMutationOptions = {}): Promise<CenterCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedAddressLine1 = input.addressLine1.trim();
  const normalizedAddressLine2 = input.addressLine2.trim() || null;
  const normalizedLandmark = input.landmark.trim() || null;
  const normalizedPostalCode = input.postalCode.trim() || null;
  const isActive = input.status === "ACTIVE";

  if (!isDatabaseConfigured) {
    const existing = MOCK_CENTERS.find((center) => center.id === input.centerId);
    if (!existing) {
      throw new Error("Center not found.");
    }

    return buildMockCenterResult({
      id: existing.id,
      name: normalizedName,
      addressLine1: normalizedAddressLine1,
      addressLine2: normalizedAddressLine2,
      landmark: normalizedLandmark,
      postalCode: normalizedPostalCode,
      countryId: input.countryId,
      stateId: input.stateId,
      cityId: input.cityId,
      totalCapacity: input.totalCapacity,
      currentUtilization: input.currentUtilization,
      complianceStatus: input.complianceStatus,
      isActive,
    });
  }

  const existing = await prisma.trainingCentre.findUnique({
    where: { id: input.centerId },
    select: { id: true, name: true, isActive: true },
  });

  if (!existing) {
    throw new Error("Center not found.");
  }

  await assertUniqueCenterName(normalizedName, input.centerId);
  const city = await resolveLocationSelection(input.countryId, input.stateId, input.cityId);

  await prisma.trainingCentre.update({
    where: { id: input.centerId },
    data: {
      name: normalizedName,
      addressLine1: normalizedAddressLine1,
      addressLine2: normalizedAddressLine2,
      landmark: normalizedLandmark,
      postalCode: normalizedPostalCode,
      locationId: city.id,
      totalCapacity: input.totalCapacity,
      currentUtilization: input.currentUtilization,
      complianceStatus: input.complianceStatus,
      isActive,
    },
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: input.centerId,
    action: AuditActionType.UPDATED,
    actorUserId: options.actorUserId ?? null,
    status: "CENTER",
    message: `Center ${normalizedName} updated.`,
    metadata: {
      previous: {
        name: existing.name,
        isActive: existing.isActive,
      },
      next: {
        name: normalizedName,
        isActive,
      },
      location: {
        city: city.name,
        state: city.state.name,
        country: city.state.country.name,
      },
    },
  });

  const detail = await getCenterByIdService(input.centerId);
  if (!detail) {
    throw new Error("Center not found after update.");
  }

  return detail;
}

export async function archiveCenterService(centerId: string, options: CenterMutationOptions = {}): Promise<CenterCreateResult> {
  if (!isDatabaseConfigured) {
    const existing = MOCK_CENTERS.find((center) => center.id === centerId);
    if (!existing) {
      throw new Error("Center not found.");
    }

    return {
      ...existing,
      isActive: false,
    };
  }

  const existing = await prisma.trainingCentre.findUnique({
    where: { id: centerId },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new Error("Center not found.");
  }

  await prisma.trainingCentre.update({
    where: { id: centerId },
    data: { isActive: false },
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: centerId,
    action: AuditActionType.UPDATED,
    actorUserId: options.actorUserId ?? null,
    status: "CENTER",
    message: `Center ${existing.name} archived.`,
    metadata: {
      isActive: false,
    },
  });

  const detail = await getCenterByIdService(centerId);
  if (!detail) {
    throw new Error("Center not found after archive.");
  }

  return detail;
}