import crypto from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

function legacySha256(password: string): Buffer {
  return crypto.createHash("sha256").update(`fashionorders_salt_${password}`).digest();
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyPassword(
  stored: string,
  password: string
): { ok: boolean; needsUpgrade: boolean } {
  try {
    if (stored.startsWith("scrypt$")) {
      const parts = stored.split("$");
      if (parts.length !== 6) return { ok: false, needsUpgrade: false };
      const salt = Buffer.from(parts[4], "base64url");
      const expected = Buffer.from(parts[5], "base64url");
      const actual = crypto.scryptSync(password, salt, expected.length, {
        N: Number(parts[1]),
        r: Number(parts[2]),
        p: Number(parts[3]),
      });
      return { ok: safeEqual(expected, actual), needsUpgrade: false };
    }

    const expected = Buffer.from(stored, "hex");
    const actual = legacySha256(password);
    const ok = safeEqual(expected, actual);
    return { ok, needsUpgrade: ok };
  } catch {
    return { ok: false, needsUpgrade: false };
  }
}

let dummyHash = "";

export function dummyVerify(password: string): void {
  if (!dummyHash) dummyHash = hashPassword("not-a-real-account");
  verifyPassword(dummyHash, password);
}
