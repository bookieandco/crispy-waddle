export type ConnectorState =
  | 'connected'
  | 'degraded'
  | 'auth_required'
  | 'rate_limited'
  | 'error'
  | 'disabled'
  | 'revoked';

export type OperationKind =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'execute'
  | 'transfer'
  | 'deploy';

export type Reversibility = 'reversible' | 'partially_reversible' | 'irreversible';

export interface ConnectorOperation {
  readonly name: string;
  readonly capability: string;
  readonly kind: OperationKind;
  readonly reversibility: Reversibility;
  readonly description: string;
}

export interface ConnectorManifest {
  readonly id: string;
  readonly provider: string;
  readonly version: number;
  readonly operations: readonly ConnectorOperation[];
}

export interface ConnectorRequest<TInput = unknown> {
  readonly connectorId: string;
  readonly operation: string;
  readonly capability: string;
  readonly input: TInput;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface ConnectorResponse<TOutput = unknown> {
  readonly connectorId: string;
  readonly operation: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly status: 'succeeded' | 'failed';
  readonly output?: TOutput;
  readonly error?: string;
  readonly verified: boolean;
}

export interface ConnectorAdapter {
  readonly manifest: ConnectorManifest;
  readonly state: ConnectorState;
  execute<TInput, TOutput>(
    operation: ConnectorOperation,
    input: TInput,
    request: ConnectorRequest<TInput>,
  ): Promise<TOutput>;
  verify<TOutput>(
    operation: ConnectorOperation,
    output: TOutput,
    request: ConnectorRequest,
  ): Promise<boolean>;
}

export class ConnectorRegistry {
  private readonly adapters = new Map<string, ConnectorAdapter>();

  register(adapter: ConnectorAdapter): void {
    const { id, version, operations } = adapter.manifest;
    if (!id.trim()) throw new Error('Connector id is required');
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Invalid connector version: ${id}`);
    }
    if (this.adapters.has(id)) throw new Error(`Connector already registered: ${id}`);
    if (operations.length === 0) throw new Error(`Connector has no operations: ${id}`);

    const names = new Set<string>();
    for (const operation of operations) {
      if (!operation.name.trim()) throw new Error(`Operation name is required: ${id}`);
      if (!operation.capability.trim()) throw new Error(`Operation capability is required: ${id}.${operation.name}`);
      if (names.has(operation.name)) throw new Error(`Duplicate operation: ${id}.${operation.name}`);
      names.add(operation.name);
    }
    this.adapters.set(id, adapter);
  }

  get(id: string): ConnectorAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): readonly ConnectorManifest[] {
    return [...this.adapters.values()].map(({ manifest }) => manifest);
  }
}

export class ConnectorGateway {
  private readonly results = new Map<string, ConnectorResponse>();

  constructor(private readonly registry: ConnectorRegistry) {}

  async execute<TInput, TOutput>(request: ConnectorRequest<TInput>): Promise<ConnectorResponse<TOutput>> {
    if (!request.idempotencyKey.trim()) throw new Error('Idempotency key is required');
    if (!request.correlationId.trim()) throw new Error('Correlation id is required');

    const previous = this.results.get(request.idempotencyKey);
    if (previous) return previous as ConnectorResponse<TOutput>;

    const adapter = this.registry.get(request.connectorId);
    if (!adapter) throw new Error(`Connector not registered: ${request.connectorId}`);
    if (adapter.state !== 'connected' && adapter.state !== 'degraded') {
      throw new Error(`Connector unavailable: ${request.connectorId} (${adapter.state})`);
    }

    const operation = adapter.manifest.operations.find((candidate) => candidate.name === request.operation);
    if (!operation) throw new Error(`Operation not registered: ${request.connectorId}.${request.operation}`);
    if (operation.capability !== request.capability) {
      throw new Error(`Capability mismatch: ${request.connectorId}.${request.operation}`);
    }

    try {
      const output = await adapter.execute<TInput, TOutput>(operation, request.input, request);
      const verified = await adapter.verify(operation, output, request);
      const response: ConnectorResponse<TOutput> = {
        connectorId: request.connectorId,
        operation: request.operation,
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey,
        status: 'succeeded',
        output,
        verified,
      };
      this.results.set(request.idempotencyKey, response);
      return response;
    } catch (error) {
      const response: ConnectorResponse<TOutput> = {
        connectorId: request.connectorId,
        operation: request.operation,
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        verified: false,
      };
      this.results.set(request.idempotencyKey, response);
      return response;
    }
  }
}

export { createGitHubReadOnlyAdapter } from './github.js';
export type { GitHubReadTransport, GitHubRepository } from './github.js';
