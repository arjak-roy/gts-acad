import "server-only";

import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

const HMS_API_BASE = "https://api.100ms.live/v2";
const HMS_TOKEN_ENDPOINT = "https://prod-in2.100ms.live/hmsapi";
const MANAGEMENT_TOKEN_TTL_SECONDS = 86_400;
const AUTH_TOKEN_TTL_SECONDS = 3_600;

type HmsCredentials = {
  accessKey: string;
  secret: string;
  templateId: string;
};

type HmsRoom = {
  id: string;
  name: string;
  enabled: boolean;
};

type HmsRoomCodeEntry = {
  code: string;
  role: string;
  enabled: boolean;
};

export type HmsRoomInfo = {
  roomId: string;
  roomCodes: {
    host: string | null;
    guest: string | null;
  };
};

function getHmsCredentials(): HmsCredentials {
  const accessKey = process.env.HMS_ACCESS_KEY ?? "";
  const secret = process.env.HMS_SECRET ?? "";
  const templateId = process.env.HMS_TEMPLATE_ID ?? "";

  if (!accessKey || !secret) {
    throw new Error("100ms credentials are not configured. Set HMS_ACCESS_KEY and HMS_SECRET environment variables.");
  }

  return { accessKey, secret, templateId };
}

async function generateManagementToken(credentials: HmsCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    access_key: credentials.accessKey,
    type: "management",
    version: 2,
    iat: now,
    nbf: now,
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + MANAGEMENT_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(credentials.secret));

  return token;
}

export async function generateAuthToken(options: {
  roomId: string;
  role: "broadcaster" | "viewer-on-stage";
  userId: string;
  userName?: string;
}): Promise<string> {
  const credentials = getHmsCredentials();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    access_key: credentials.accessKey,
    type: "app",
    version: 2,
    room_id: options.roomId,
    user_id: options.userId,
    role: options.role,
    iat: now,
    nbf: now,
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + AUTH_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(credentials.secret));

  return token;
}

async function hmsApiRequest<T>(path: string, options: {
  method?: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const credentials = getHmsCredentials();
  const managementToken = await generateManagementToken(credentials);

  const response = await fetch(`${HMS_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Authorization": `Bearer ${managementToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`100ms API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

export async function createHmsRoom(name: string): Promise<HmsRoomInfo> {
  const credentials = getHmsCredentials();

  const room = await hmsApiRequest<HmsRoom>("/rooms", {
    method: "POST",
    body: {
      name,
      description: `GTS Academy live class: ${name}`,
      ...(credentials.templateId ? { template_id: credentials.templateId } : {}),
    },
  });

  const roomCodes = await hmsApiRequest<{ data: HmsRoomCodeEntry[] }>(`/room-codes/room/${room.id}`, {
    method: "POST",
  });

  const hostCode = roomCodes.data.find((entry) => entry.role === "broadcaster" && entry.enabled)?.code ?? null;
  const guestCode = roomCodes.data.find((entry) => entry.role === "viewer-on-stage" && entry.enabled)?.code ?? null;

  return {
    roomId: room.id,
    roomCodes: {
      host: hostCode,
      guest: guestCode,
    },
  };
}

export async function getHmsRoomCodes(roomId: string): Promise<{ host: string | null; guest: string | null }> {
  const roomCodes = await hmsApiRequest<{ data: HmsRoomCodeEntry[] }>(`/room-codes/room/${roomId}`, {
    method: "POST",
  });

  const hostCode = roomCodes.data.find((entry) => entry.role === "broadcaster" && entry.enabled)?.code ?? null;
  const guestCode = roomCodes.data.find((entry) => entry.role === "viewer-on-stage" && entry.enabled)?.code ?? null;

  return { host: hostCode, guest: guestCode };
}

export async function disableHmsRoom(roomId: string): Promise<void> {
  await hmsApiRequest<HmsRoom>(`/rooms/${roomId}`, {
    method: "POST",
    body: { enabled: false },
  });
}
