import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { trainerIdSchema, uploadTrainerProfilePhotoSchema } from "@/lib/validation-schemas/trainers";
import { deleteStoredUploadAsset, getStoredUploadAssetUrl, storeUploadedCandidateProfilePhotoAsset, validateUploadedFileAgainstGlobalSettings } from "@/services/file-upload";
import { updateTrainerProfilePhotoService } from "@/services/trainers-service";

export const runtime = "nodejs";

const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

type RouteContext = {
  params: {
    trainerId: string;
  };
};

function resolveTrainerPhotoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }

  const storageProvider = value.startsWith("candidate-profile-photos/") ? "S3" : "LOCAL_PUBLIC";
  return getStoredUploadAssetUrl({ storageProvider, storagePath: value });
}

function getMimeTypeExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpg":
    case "image/jpeg":
    default:
      return "jpg";
  }
}

function parseProfilePhotoDataUri(value: string) {
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,([a-z0-9+/=\s]+)$/i.exec(value.trim());

  if (!match) {
    throw new Error("Upload a PNG or JPEG image.");
  }

  const [, mimeType, base64Payload] = match;
  const body = Buffer.from(base64Payload.replace(/\s+/g, ""), "base64");

  if (body.length === 0) {
    throw new Error("Profile photo is required.");
  }

  if (body.length > MAX_PROFILE_PHOTO_SIZE_BYTES) {
    throw new Error("Profile photo exceeds the 5 MB limit.");
  }

  return {
    body,
    mimeType: mimeType.toLowerCase(),
  };
}

function buildUploadFileName(rawFileName: string | undefined, mimeType: string) {
  const normalizedBaseName = rawFileName?.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const extension = getMimeTypeExtension(mimeType);

  if (!normalizedBaseName) {
    return `trainer-photo.${extension}`;
  }

  if (/\.[a-z0-9]+$/i.test(normalizedBaseName)) {
    return normalizedBaseName;
  }

  return `${normalizedBaseName}.${extension}`;
}

async function getCurrentTrainerPhotoRecord(trainerId: string) {
  if (!isDatabaseConfigured) {
    return null;
  }

  return prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      profilePhotoUrl: true,
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "trainers.edit");
    const { trainerId } = trainerIdSchema.parse(params);
    const input = uploadTrainerProfilePhotoSchema.parse(await request.json());
    const { body, mimeType } = parseProfilePhotoDataUri(input.photoDataUri);

    const currentPhotoRecord = await getCurrentTrainerPhotoRecord(trainerId);
    const file = new File([body], buildUploadFileName(input.fileName, mimeType), {
      type: mimeType,
    });

    await validateUploadedFileAgainstGlobalSettings(file);

    const asset = await storeUploadedCandidateProfilePhotoAsset(file, `trainer-${trainerId}`);

    try {
      const result = await updateTrainerProfilePhotoService(trainerId, asset.storagePath, session.userId);

      if (currentPhotoRecord?.profilePhotoUrl && currentPhotoRecord.profilePhotoUrl !== asset.storagePath) {
        await deleteStoredUploadAsset({
          storageProvider: "S3",
          storagePath: currentPhotoRecord.profilePhotoUrl,
        });
      }

      return apiSuccess({
        ...result,
        profilePhotoUrl: resolveTrainerPhotoUrl(result.profilePhotoUrl),
      });
    } catch (error) {
      await deleteStoredUploadAsset({
        storageProvider: asset.storageProvider,
        storagePath: asset.storagePath,
      });
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "trainers.edit");
    const { trainerId } = trainerIdSchema.parse(params);
    const currentPhotoRecord = await getCurrentTrainerPhotoRecord(trainerId);

    const result = await updateTrainerProfilePhotoService(trainerId, null, session.userId);

    if (currentPhotoRecord?.profilePhotoUrl) {
      await deleteStoredUploadAsset({
        storageProvider: "S3",
        storagePath: currentPhotoRecord.profilePhotoUrl,
      });
    }

    return apiSuccess({
      ...result,
      profilePhotoUrl: resolveTrainerPhotoUrl(result.profilePhotoUrl),
    });
  } catch (error) {
    return apiError(error);
  }
}
