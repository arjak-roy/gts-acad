import "server-only";

import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    throw new Error("Password is required.");
  }

  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(normalizedPassword, salt, KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedPassword: string) {
  const normalizedPassword = password.trim();

  if (!storedPassword.startsWith(`${HASH_PREFIX}$`)) {
    return {
      isValid: normalizedPassword === storedPassword,
      needsUpgrade: normalizedPassword === storedPassword,
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
    needsUpgrade: false,
  };
}
