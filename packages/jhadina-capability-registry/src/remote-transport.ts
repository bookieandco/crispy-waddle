import type { ResolvedRemoteCommand } from './remote-resolver.js';

export interface RemoteTransport {
  readonly kind: string;
  supports(command: ResolvedRemoteCommand): boolean;
  execute(command: ResolvedRemoteCommand): Promise<void>;
}

export class TransportRouter {
  constructor(private readonly transports: readonly RemoteTransport[]) {}

  resolve(command: ResolvedRemoteCommand): RemoteTransport {
    const transport = this.transports.find(candidate => candidate.supports(command));
    if (!transport) throw new Error(`No transport for capability: ${command.capability}`);
    return transport;
  }

  async execute(command: ResolvedRemoteCommand): Promise<void> {
    await this.resolve(command).execute(command);
  }
}
