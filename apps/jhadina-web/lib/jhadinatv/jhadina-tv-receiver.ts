import type { JhadinaTVReceiverTransport, MediaSessionCommand, MediaSessionState, PlaybackTarget } from '@jhadina/tv-core';

interface ReceiverDescriptor { id: string; name: string; url: string; authToken: string; }

export function createJhadinaTVReceiverTransport(discoveryUrl = '/api/jhadinatv/receivers'): JhadinaTVReceiverTransport {
  let socket: WebSocket | null = null;
  let current: PlaybackTarget | undefined;
  let state: MediaSessionState | null = null;
  let authenticated = false;

  async function fetchReceivers(): Promise<ReceiverDescriptor[]> {
    const response = await fetch(discoveryUrl, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`JhadinaTV receiver discovery failed (${response.status}).`);
    const body = await response.json() as unknown;
    if (!Array.isArray(body)) throw new Error('Invalid receiver registry response.');
    return body.filter((entry): entry is ReceiverDescriptor =>
      Boolean(entry && typeof entry.id === 'string' && typeof entry.name === 'string' &&
        typeof entry.url === 'string' && entry.url.startsWith('wss://') &&
        typeof entry.authToken === 'string'));
  }

  async function discover(): Promise<PlaybackTarget[]> {
    const receivers = await fetchReceivers();
    return receivers.map((r) => ({ id: r.id, name: r.name, transport: 'jhadinatv-tv' as const }));
  }

  async function connect(target: PlaybackTarget): Promise<void> {
    if (!target.id || target.transport !== 'jhadinatv-tv') throw new Error('Invalid TV receiver target.');
    const receiver = (await fetchReceivers()).find((item) => item.id === target.id);
    if (!receiver) throw new Error('This receiver is not an admitted device.');
    const url = new URL(receiver.url);
    if (url.protocol !== 'wss:') throw new Error('A verified WSS receiver is required.');
    if (socket && authenticated) throw new Error('Disconnect the existing TV session before pairing a new receiver.');
    authenticated = false;
    current = undefined;
    state = null;

    await new Promise<void>((resolve, reject) => {
      const candidate = new WebSocket(receiver.url);
      socket = candidate;
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('TV receiver authentication timed out.')), 5000);
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) {
          candidate.close();
          if (socket === candidate) socket = null;
          reject(error);
        } else {
          current = target;
          authenticated = true;
          resolve();
        }
      };
      candidate.onopen = () => candidate.send(JSON.stringify({
        type: 'authenticate', receiverId: target.id, token: receiver.authToken,
      }));
      candidate.onerror = () => finish(new Error('Unable to authenticate TV receiver.'));
      candidate.onclose = () => {
        if (!authenticated) finish(new Error('TV receiver closed before authentication.'));
        if (socket === candidate) { socket = null; current = undefined; authenticated = false; state = null; }
      };
      candidate.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: string; verified?: boolean; receiverId?: string; state?: MediaSessionState;
          };
          if (!authenticated) {
            if (message.type === 'authenticated' && message.verified === true && message.receiverId === target.id) finish();
            else finish(new Error('TV receiver refused signed authentication.'));
            return;
          }
          if (message.state) state = message.state;
        } catch {
          if (!authenticated) finish(new Error('Invalid TV receiver authentication response.'));
        }
      };
    });
  }

  async function send(command: MediaSessionCommand): Promise<void> {
    if (!socket || !authenticated || socket.readyState !== WebSocket.OPEN) {
      throw new Error('JhadinaTV receiver is not authenticated.');
    }
    socket.send(JSON.stringify({ type: 'command', command }));
  }

  return {
    discover,
    connect,
    async load(sourceUrl, positionSeconds) {
      if (!socket || !authenticated || socket.readyState !== WebSocket.OPEN) {
        throw new Error('JhadinaTV receiver is not authenticated.');
      }
      const media = new URL(sourceUrl);
      if (media.protocol !== 'https:') throw new Error('Receiver media must use HTTPS.');
      // The receiver must verify the cast-scoped URL and report playback state.
      socket.send(JSON.stringify({ type: 'load', sourceUrl, positionSeconds }));
    },
    send,
    async state() { return authenticated ? state : null; },
    async disconnect() {
      authenticated = false;
      current = undefined;
      state = null;
      socket?.close(1000, 'client disconnect');
      socket = null;
    },
  };
}
