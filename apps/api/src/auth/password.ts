import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Passwords are never stored, only a scrypt hash: a deliberately slow,
 * memory-hungry function, so guessing millions of passwords from a stolen
 * database is impractical. Node has it built in, so no extra library.
 *
 * Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
 */
const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, KEY_LENGTH, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  // A random salt per password: two people with the same password get different hashes.
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, rr, pp, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(rr), p: Number(pp) });
  // timingSafeEqual takes the same time however many characters match.
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Rules for a password someone picks. */
export const PASSWORD_RULE = { min: 8, message: 'Use at least 8 characters' };
