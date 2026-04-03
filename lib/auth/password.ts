import "server-only";

import { scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { compare as bcryptCompare, hash as bcryptHash } from "bcryptjs";

import { AUTH_SECURITY_CONFIG } from "@/lib/auth/config";

const scrypt = promisify(nodeScrypt);
const BCRYPT_PREFIX = "bcrypt";
const LEGACY_SCRYPT_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.+/;

function extractBcryptHash(storedPassword: string) {
  if (storedPassword.startsWith(`${BCRYPT_PREFIX}$`)) {
    return storedPassword.slice(BCRYPT_PREFIX.length + 1);
  }

  if (BCRYPT_HASH_PATTERN.test(storedPassword)) {
    return storedPassword;
  }

  return null;
}

function verifyLegacyPlaintextPassword(password: string, storedPassword: string) {
  const passwordBuffer = Buffer.from(password);
  const storedPasswordBuffer = Buffer.from(storedPassword);

  if (passwordBuffer.length !== storedPasswordBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordBuffer, storedPasswordBuffer);
}

export async function hashPassword(password: string) {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    throw new Error("Password is required.");
  }

  const hash = await bcryptHash(normalizedPassword, AUTH_SECURITY_CONFIG.bcryptRounds);
  return `${BCRYPT_PREFIX}$${hash}`;
}

export async function verifyPassword(password: string, storedPassword: string) {
  const normalizedPassword = password.trim();

  const bcryptStoredHash = extractBcryptHash(storedPassword);
  if (bcryptStoredHash) {
    const isValid = await bcryptCompare(normalizedPassword, bcryptStoredHash);
    return {
      isValid,
      needsUpgrade: false,
    };
  }

  if (!storedPassword.startsWith(`${LEGACY_SCRYPT_PREFIX}$`)) {
    if (!AUTH_SECURITY_CONFIG.allowLegacyPlaintextPasswords) {
      return {
        isValid: false,
        needsUpgrade: false,
      };
    }

    const isValid = verifyLegacyPlaintextPassword(normalizedPassword, storedPassword);
    return {
      isValid,
      needsUpgrade: isValid,
    };
  }

  const [, salt, storedHash] = storedPassword.split("$");
  if (!salt || !storedHash) {
    return { isValid: false, needsUpgrade: false };
  }

  const derivedKey = (await scrypt(normalizedPassword, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return { isValid: false, needsUpgrade: false };
  }

  return {
    isValid: timingSafeEqual(storedBuffer, derivedKey),
    needsUpgrade: true,
  };
}
