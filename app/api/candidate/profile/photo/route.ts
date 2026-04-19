import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { uploadCandidateSelfProfilePhotoSchema } from "@/lib/validation-schemas/candidate-profile";
import { deleteStoredUploadAsset, storeUploadedCandidateProfilePhotoAsset, validateUploadedFileAgainstGlobalSettings } from "@/services/file-upload";
import { updateCandidateProfilePhotoService } from "@/services/learners-service";

export const runtime = "nodejs";

const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function getMimeTypeExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpg":
    case "image/jpeg":
    default:
      return "jpg";
  }
}

function parseProfilePhotoDataUri(value: string) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(value.trim());

  if (!match) {
    throw new Error("Upload a PNG, JPEG, or WEBP image.");
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
    return `profile-photo.${extension}`;
  }

  if (/\.[a-z0-9]+$/i.test(normalizedBaseName)) {
    return normalizedBaseName;
  }

  return `${normalizedBaseName}.${extension}`;
}

async function getCurrentLearnerPhotoRecord(userId: string) {
  if (!isDatabaseConfigured) {
    return null;
  }

  return prisma.learner.findFirst({
    where: { userId },
    select: {
      id: true,
      profileImageUrl: true,
    },
  });
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["POST", "DELETE", "OPTIONS"]);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const input = uploadCandidateSelfProfilePhotoSchema.parse(await request.json());
    const { body, mimeType } = parseProfilePhotoDataUri(input.photoDataUri);
    const currentPhotoRecord = await getCurrentLearnerPhotoRecord(session.userId);
    const file = new File([body], buildUploadFileName(input.fileName, mimeType), {
      type: mimeType,
    });

    await validateUploadedFileAgainstGlobalSettings(file);

    const asset = await storeUploadedCandidateProfilePhotoAsset(file, currentPhotoRecord?.id ?? session.userId);

    try {
      const profile = await updateCandidateProfilePhotoService(session.userId, asset.storagePath, session.userId);

      if (currentPhotoRecord?.profileImageUrl && currentPhotoRecord.profileImageUrl !== asset.storagePath) {
        await deleteStoredUploadAsset({
          storageProvider: "S3",
          storagePath: currentPhotoRecord.profileImageUrl,
        });
      }

      const response = apiSuccess(profile);
      return withCors(request, response, ["POST", "DELETE", "OPTIONS"]);
    } catch (error) {
      await deleteStoredUploadAsset({
        storageProvider: asset.storageProvider,
        storagePath: asset.storagePath,
      });
      throw error;
    }
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "DELETE", "OPTIONS"]);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const currentPhotoRecord = await getCurrentLearnerPhotoRecord(session.userId);
    const profile = await updateCandidateProfilePhotoService(session.userId, null, session.userId);

    if (currentPhotoRecord?.profileImageUrl) {
      await deleteStoredUploadAsset({
        storageProvider: "S3",
        storagePath: currentPhotoRecord.profileImageUrl,
      });
    }

    const response = apiSuccess(profile);
    return withCors(request, response, ["POST", "DELETE", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["POST", "DELETE", "OPTIONS"]);
  }
}