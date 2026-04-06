import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SETTINGS_ENCRYPTION_ALGORITHM = "aes-256-gcm";

type EncryptedSettingsEnvelope = {
  __encrypted: true;
  algorithm: typeof SETTINGS_ENCRYPTION_ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getSettingsEncryptionKey() {
  const secret = process.env.SETTINGS_ENCRYPTION_SECRET ?? process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("SETTINGS_ENCRYPTION_SECRET or AUTH_SESSION_SECRET is required for encrypted settings.");
  }

  return createHash("sha256").update(secret).digest();
}

export function isEncryptedSettingsEnvelope(value: unknown): value is EncryptedSettingsEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<EncryptedSettingsEnvelope>;
  return candidate.__encrypted === true && candidate.algorithm === SETTINGS_ENCRYPTION_ALGORITHM;
}

export function encryptSettingsValue(value: unknown): EncryptedSettingsEnvelope {
  const key = getSettingsEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(SETTINGS_ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = JSON.stringify(value ?? null);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    __encrypted: true,
    algorithm: SETTINGS_ENCRYPTION_ALGORITHM,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptSettingsValue<T = unknown>(value: unknown): T | null {
  if (!isEncryptedSettingsEnvelope(value)) {
    return value as T;
  }

  const key = getSettingsEncryptionKey();
  const decipher = createDecipheriv(SETTINGS_ENCRYPTION_ALGORITHM, key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as T;
}