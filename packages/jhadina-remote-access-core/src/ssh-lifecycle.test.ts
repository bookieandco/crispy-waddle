import { describe, expect, it } from 'vitest';
import { InMemorySshCredentialProvider } from './credentials.js';

describe('SSH credential boundary', () => {
  it('resolves by opaque reference rather than endpoint data', async () => {
    const provider = new InMemorySshCredentialProvider();
    provider.put({ id: 'cred-1' }, { username: 'operator', password: 'secret' });
    await expect(provider.resolve({ id: 'cred-1' })).resolves.toEqual({
      username: 'operator',
      password: 'secret',
    });
  });

  it('fails closed for an unknown reference', async () => {
    const provider = new InMemorySshCredentialProvider();
    await expect(provider.resolve({ id: 'missing' })).rejects.toThrow('SSH credential not found: missing');
  });
});
