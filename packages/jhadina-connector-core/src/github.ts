import type {
  ConnectorAdapter,
  ConnectorOperation,
  ConnectorRequest,
} from './index.js';

export interface GitHubRepository {
  readonly fullName: string;
  readonly name: string;
  readonly owner: string;
  readonly private: boolean;
  readonly defaultBranch: string;
  readonly htmlUrl: string;
}

export interface GitHubReadTransport {
  getRepository(repository: string): Promise<GitHubRepository>;
}

const operations: readonly ConnectorOperation[] = [
  {
    name: 'repo.read',
    capability: 'github.repo.read',
    kind: 'read',
    reversibility: 'reversible',
    description: 'Read GitHub repository metadata',
  },
];

export function createGitHubReadOnlyAdapter(
  transport: GitHubReadTransport,
): ConnectorAdapter {
  return {
    manifest: {
      id: 'github',
      provider: 'github',
      version: 1,
      operations,
    },
    state: 'connected',
    async execute<TInput, TOutput>(
      operation: ConnectorOperation,
      input: TInput,
      _request: ConnectorRequest<TInput>,
    ): Promise<TOutput> {
      if (operation.name !== 'repo.read') {
        throw new Error(`Unsupported GitHub operation: ${operation.name}`);
      }

      if (!isRepositoryInput(input)) {
        throw new Error('GitHub repo.read requires repository=owner/name');
      }

      return (await transport.getRepository(input.repository)) as TOutput;
    },
    async verify<TOutput>(
      operation: ConnectorOperation,
      output: TOutput,
    ): Promise<boolean> {
      if (operation.name !== 'repo.read') return false;
      return isGitHubRepository(output);
    },
  };
}

function isRepositoryInput(value: unknown): value is { repository: string } {
  if (!value || typeof value !== 'object') return false;
  const repository = (value as { repository?: unknown }).repository;
  return typeof repository === 'string' && /^[^/\s]+\/[^/\s]+$/.test(repository);
}

function isGitHubRepository(value: unknown): value is GitHubRepository {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GitHubRepository>;
  return (
    typeof candidate.fullName === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.owner === 'string' &&
    typeof candidate.private === 'boolean' &&
    typeof candidate.defaultBranch === 'string' &&
    typeof candidate.htmlUrl === 'string'
  );
}
