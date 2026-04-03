import 'server-only';

const DEFAULT_BCRYPT_ROUNDS = 12;
const MIN_BCRYPT_ROUNDS = 8;
const MAX_BCRYPT_ROUNDS = 15;

function parseBcryptRounds(rawValue: string | undefined) {
  if (!rawValue) {
    return DEFAULT_BCRYPT_ROUNDS;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_BCRYPT_ROUNDS;
  }

  return Math.min(Math.max(parsedValue, MIN_BCRYPT_ROUNDS), MAX_BCRYPT_ROUNDS);
}

function parseBooleanFlag(rawValue: string | undefined, fallback: boolean) {
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

export const AUTH_SECURITY_CONFIG = {
  bcryptRounds: parseBcryptRounds(process.env.AUTH_BCRYPT_ROUNDS),
  allowLegacyPlaintextPasswords: parseBooleanFlag(process.env.AUTH_ALLOW_LEGACY_PLAINTEXT_PASSWORDS, false),
};