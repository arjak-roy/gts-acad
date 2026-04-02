import "server-only";

import { createHmac, randomInt } from "node:crypto";

function getHashSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return secret;
}

export function getTwoFactorCodeTtlMinutes() {
  return Number.parseInt(process.env.TWO_FACTOR_CODE_TTL_MINUTES ?? "10", 10);
}

export function getTwoFactorResendCooldownSeconds() {
  return Number.parseInt(process.env.TWO_FACTOR_RESEND_COOLDOWN_SECONDS ?? "60", 10);
}

export function generateEmailOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashSensitiveToken(value: string) {
  return createHmac("sha256", getHashSecret()).update(value.trim().toUpperCase()).digest("hex");
}

export function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}${"*".repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
}

export function generateRecoveryCodes(count: number = 8) {
  return Array.from({ length: count }, () => {
    const left = randomInt(0, 0xfffff).toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
    const right = randomInt(0, 0xfffff).toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
    return `${left}-${right}`;
  });
}
