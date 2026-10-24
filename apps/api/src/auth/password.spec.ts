import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('chiller-plant-42');
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(stored).not.toContain('chiller');
    await expect(verifyPassword('chiller-plant-42', stored)).resolves.toBe(true);
    await expect(verifyPassword('chiller-plant-43', stored)).resolves.toBe(false);
  });

  it('salts every hash, so the same password hashes differently', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored value', async () => {
    await expect(verifyPassword('x', 'plain-text')).resolves.toBe(false);
  });
});
