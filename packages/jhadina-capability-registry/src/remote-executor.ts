import type { CommandResult, RemoteCommand, RemoteTransport, RemoteTransportKind } from './remote.js';

export type RemoteExecutionFailure = {
  readonly transport: RemoteTransportKind;
  readonly code: string;
  readonly message: string;
};

export class RemoteExecutionError extends Error {
  readonly failures: readonly RemoteExecutionFailure[];
  readonly command: RemoteCommand;

  constructor(command: RemoteCommand, failures: readonly RemoteExecutionFailure[]) {
    super(`Remote command failed: ${command.capability} on ${command.deviceId}`);
    this.name = 'RemoteExecutionError';
    this.command = command;
    this.failures = failures;
  }
}

export interface RemoteExecutionTelemetry {
  onAttempt?(command: RemoteCommand, transport: RemoteTransportKind): void;
  onComplete?(result: CommandResult): void;
}

export class RemoteCommandExecutor {
  constructor(
    private readonly resolve: (command: RemoteCommand) => readonly RemoteTransport[],
    private readonly telemetry?: RemoteExecutionTelemetry,
  ) {}

  async execute(command: RemoteCommand): Promise<CommandResult> {
    const transports = this.resolve(command);
    if (transports.length === 0) {
      const error = new RemoteExecutionError(command, [{ transport: 'vendor-api', code: 'NO_TRANSPORT', message: 'No authorized transport supports this command' }]);
      throw error;
    }

    const failures: RemoteExecutionFailure[] = [];
    for (let index = 0; index < transports.length; index += 1) {
      const transport = transports[index];
      this.telemetry?.onAttempt?.(command, transport.kind);
      try {
        const result = await transport.execute(command);
        const normalized: CommandResult = { ...result, capability: command.capability, deviceId: command.deviceId, transport: transport.kind, attempts: index + 1 };
        if (normalized.success) {
          this.telemetry?.onComplete?.(normalized);
          return normalized;
        }
        failures.push({ transport: transport.kind, code: normalized.error?.code ?? 'TRANSPORT_FAILED', message: normalized.error?.message ?? 'Transport reported failure' });
      } catch (cause) {
        failures.push({ transport: transport.kind, code: 'TRANSPORT_EXCEPTION', message: cause instanceof Error ? cause.message : String(cause) });
      }
    }

    throw new RemoteExecutionError(command, failures);
  }
}
