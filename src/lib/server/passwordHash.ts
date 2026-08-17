import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Static hash used for constant-time login when email is unknown. */
export const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$deadbeefdeadbeefdeadbeefdeadbeef$_Bxm4QS1K-iTxpBVeSSxkYxEYo_1ThrkUwz5Xmkw5HmiLicFMpulc9CvSF3bYnixLst_MkQXq57sSqiT1vJM4w";

type ParsedHash = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
};

function encodeHash(salt: Buffer, hash: Buffer): string {
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("base64url")}`;
}

function parseEncodedHash(encoded: string): ParsedHash | null {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }

  try {
    const saltPart = parts[4];
    const hashPart = parts[5];
    if (!saltPart || !hashPart) {
      return null;
    }
    const salt = Buffer.from(saltPart, "hex");
    const hash = Buffer.from(hashPart, "base64url");
    if (salt.length === 0 || hash.length === 0) {
      return null;
    }
    return { N, r, p, salt, hash };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return encodeHash(salt, hash);
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parsed = parseEncodedHash(encoded);
  if (!parsed) {
    return false;
  }

  const derived = await scryptAsync(password, parsed.salt, KEY_LENGTH, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
  });

  if (derived.length !== parsed.hash.length) {
    return false;
  }

  return timingSafeEqual(derived, parsed.hash);
}

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function runDummyPasswordVerify(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_PASSWORD_HASH);
}
