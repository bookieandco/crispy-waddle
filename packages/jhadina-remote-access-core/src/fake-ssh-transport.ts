import type { RemoteTransportRequest, RemoteTransportSession } from './transport-lifecycle.js';
import { assertTransportCommand } from './transport-lifecycle.js';

export class FakeSshTransport {
  readonly commands: string[] = [];
  private connected = false;

  async connect(_connection: unknown, request?: RemoteTransportRequest): Promise<RemoteTransportSession> {
    if (request?.signal?.aborted) throw new Error('Remote connection aborted');
    this.connected = true;
    const self = this;
    return {
      get state() { return self.connected ? 'connected' : 'closed'; },
      async execute(command: string) {
        assertTransportCommand(command);
        if (!self.connected) throw new Error('Remote session is not connected');
        self.commands.push(command);
        return `fake-ssh:${command}`;
      },
      async close() {
        self.connected = false;
      },
    };
  }
}
