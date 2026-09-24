import { Client } from 'ssh2';
import type { RemoteTransport, RemoteTransportRequest, RemoteTransportSession } from './transport-lifecycle.js';

type Ssh2Connection = Readonly<{
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  passphrase?: string;
  hostHash?: string;
  hostVerifier?: (key: string) => boolean;
}>;

export class Ssh2Transport implements RemoteTransport<Ssh2Connection> {
  async connect(connection: Ssh2Connection, request?: RemoteTransportRequest): Promise<RemoteTransportSession> {
    const client = new Client();
    const sessionId = request?.sessionId;
    if (!sessionId) throw new Error('Remote sessionId is required');
    if (request?.signal?.aborted) throw new Error('Remote connection aborted');

    let state: RemoteTransportSession['state'] = 'connecting';
    const connectPromise = new Promise<void>((resolve, reject) => {
      client.once('ready', () => { state = 'connected'; resolve(); });
      client.once('error', reject);
      client.connect({ ...connection, readyTimeout: request?.timeoutMs });
    });

    await connectPromise;

    return {
      sessionId,
      get state() { return state; },
      async execute(command: string) {
        if (state !== 'connected') throw new Error('Remote session is not connected');
        return new Promise<string>((resolve, reject) => {
          client.exec(command, (error, stream) => {
            if (error) { reject(error); return; }
            let stdout = '';
            let stderr = '';
            stream.on('data', (data: Buffer) => { stdout += data.toString(); });
            stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
            stream.once('close', (code: number | null, signal: string | null) => {
              if (code && code !== 0) reject(new Error(`SSH command failed: code=${code} signal=${signal ?? 'none'} stderr=${stderr}`));
              else resolve(stdout);
            });
          });
        });
      },
      async close() {
        if (state === 'closed') return;
        state = 'closing';
        client.end();
        state = 'closed';
      },
    };
  }
}
