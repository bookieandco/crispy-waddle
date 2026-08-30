import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectorGateway, ConnectorRegistry } from './index.js';
import { createGitHubReadOnlyAdapter, type GitHubRepository } from './github.js';

test('GitHub adapter exposes only read-only repository metadata', () => {
  const calls: string[] = [];
  const repository: GitHubRepository = {
    fullName: 'bookieandco/crispy-waddle',
    name: 'crispy-waddle',
    owner: 'bookieandco',
    private: true,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/bookieandco/crispy-waddle',
  };

  const adapter = createGitHubReadOnlyAdapter({
    async getRepository(value) {
      calls.push(value);
      return repository;
    },
  });

  assert.deepEqual(adapter.manifest.operations.map((operation) => operation.name), ['repo.read']);
  assert.equal(adapter.manifest.operations[0]?.capability, 'github.repo.read');
  assert.equal(calls.length, 0);
});

test('GitHub read-only adapter executes through the connector gateway', async () => {
  const repository: GitHubRepository = {
    fullName: 'bookieandco/crispy-waddle',
    name: 'crispy-waddle',
    owner: 'bookieandco',
    private: true,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/bookieandco/crispy-waddle',
  };

  const registry = new ConnectorRegistry();
  registry.register(
    createGitHubReadOnlyAdapter({
      async getRepository(value) {
        assert.equal(value, 'bookieandco/crispy-waddle');
        return repository;
      },
    }),
  );

  const gateway = new ConnectorGateway(registry);
  const response = await gateway.execute({
    connectorId: 'github',
    operation: 'repo.read',
    capability: 'github.repo.read',
    input: { repository: 'bookieandco/crispy-waddle' },
    idempotencyKey: 'github-read-1',
    correlationId: 'github-corr-1',
  });

  assert.equal(response.status, 'succeeded');
  assert.equal(response.verified, true);
  assert.deepEqual(response.output, repository);
});

test('GitHub adapter rejects malformed repository targets', async () => {
  const adapter = createGitHubReadOnlyAdapter({
    async getRepository() {
      throw new Error('transport must not be called');
    },
  });

  await assert.rejects(
    adapter.execute(
      adapter.manifest.operations[0]!,
      { repository: 'not-a-repository' },
      {
        connectorId: 'github',
        operation: 'repo.read',
        capability: 'github.repo.read',
        input: { repository: 'not-a-repository' },
        idempotencyKey: 'github-read-2',
        correlationId: 'github-corr-2',
      },
    ),
    /owner\/name/,
  );
});

test('GitHub adapter rejects unverified output', async () => {
  const adapter = createGitHubReadOnlyAdapter({
    async getRepository() {
      return { fullName: 'bookieandco/crispy-waddle' } as GitHubRepository;
    },
  });

  const response = await new ConnectorGateway(
    new ConnectorRegistry(),
  ).execute;
  void response;

  assert.equal(
    await adapter.verify(adapter.manifest.operations[0]!, { fullName: 'incomplete' }, {
      connectorId: 'github',
      operation: 'repo.read',
      capability: 'github.repo.read',
      input: { repository: 'bookieandco/crispy-waddle' },
      idempotencyKey: 'github-read-3',
      correlationId: 'github-corr-3',
    }),
    false,
  );
});
