import type { JhadinaTVReceiverTransport, MediaSessionCommand, MediaSessionState, PlaybackTarget } from '@jhadina/tv-core';

interface ReceiverDescriptor { id: string; name: string; url: string; authToken: string; }
interface ReceiverMessage {
  type?: string; verified?: boolean; accepted?: boolean; receiverId?: string;
  requestId?: string; playbackStarted?: boolean; state?: MediaSessionState;
}
interface PendingCommand {
  type: 'command-ack'|'load-ack'; sourceUrl?: string;
  resolve: () => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Receiver ACK protocol v1: authenticate first, then one correlated ACK for
 * each command/load. A successful socket.send is NEVER playback evidence.
 * Loads require explicit playbackStarted + matching source from the receiver.
 */
export function createJhadinaTVReceiverTransport(discoveryUrl = '/api/jhadinatv/receivers'): JhadinaTVReceiverTransport {
  let socket: WebSocket | null = null;
  let state: MediaSessionState | null = null;
  let authenticated = false;
  let receiverId: string | null = null;
  let sequence = 0;
  const pending = new Map<string,PendingCommand>();

  function failPending(reason:string):void {
    for(const [id,entry] of pending) {
      clearTimeout(entry.timer);
      pending.delete(id);
      entry.reject(new Error(reason));
    }
  }

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
    if (socket) throw new Error('Disconnect the existing TV session before pairing a new receiver.');
    authenticated = false;
    receiverId = null;
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
          receiverId = target.id;
          authenticated = true;
          resolve();
        }
      };
      candidate.onopen = () => candidate.send(JSON.stringify({
        type: 'authenticate', receiverId: target.id, token: receiver.authToken,
      }));
      candidate.onerror = () => {
        if(!authenticated)finish(new Error('Unable to authenticate TV receiver.'));
        else {failPending('TV receiver transport error.'); candidate.close();}
      };
      candidate.onclose = () => {
        if (!authenticated) finish(new Error('TV receiver closed before authentication.'));
        if (socket === candidate) {
          socket = null; authenticated = false; receiverId = null; state = null;
          failPending('TV receiver disconnected before acknowledgment.');
        }
      };
      candidate.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as ReceiverMessage;
          if (!authenticated) {
            if (message.type === 'authenticated' && message.verified === true && message.receiverId === target.id) finish();
            else finish(new Error('TV receiver refused signed authentication.'));
            return;
          }
          if (message.receiverId && message.receiverId !== receiverId) return;
          if (message.state) state = message.state;
          if (!message.requestId || !pending.has(message.requestId)) return;
          const entry = pending.get(message.requestId)!;
          if (message.type !== entry.type) return;
          pending.delete(message.requestId);
          clearTimeout(entry.timer);
          if (message.receiverId !== receiverId || message.accepted !== true ||
            (entry.type === 'load-ack' &&
              (message.playbackStarted !== true || message.state?.sourceUrl !== entry.sourceUrl))) {
            entry.reject(new Error('TV receiver did not confirm the requested operation.'));
            return;
          }
          entry.resolve();
        } catch {
          if (!authenticated) finish(new Error('Invalid TV receiver authentication response.'));
        }
      };
    });
  }

  async function sendAcknowledged(
    payload: Record<string, unknown>,
    expectedType: PendingCommand['type'],
    sourceUrl?: string,
  ): Promise<void> {
    if (!socket || !authenticated || !receiverId || socket.readyState !== WebSocket.OPEN) {
      throw new Error('JhadinaTV receiver is not authenticated.');
    }
    const activeSocket = socket;
    const requestId = `jtv:${Date.now()}:${++sequence}`;
    await new Promise<void>((resolve,reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('TV receiver acknowledgment timed out; outcome unknown, do not blindly retry.'));
      },5000);
      pending.set(requestId,{type:expectedType,sourceUrl,resolve,reject,timer});
      try {
        activeSocket.send(JSON.stringify({...payload,requestId}));
      } catch(error) {
        pending.delete(requestId); clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async function send(command: MediaSessionCommand): Promise<void> {
    await sendAcknowledged({type:'command',command},'command-ack');
  }

  return {
    discover,
    connect,
    async load(sourceUrl,positionSeconds) {
      const media = new URL(sourceUrl);
      if (media.protocol !== 'https:') throw new Error('Receiver media must use HTTPS.');
      await sendAcknowledged({type:'load',sourceUrl,positionSeconds},'load-ack',sourceUrl);
    },
    send,
    async state() { return authenticated ? state : null; },
    async disconnect() {
      failPending('TV receiver disconnected before acknowledgment.');
      authenticated = false; receiverId = null; state = null;
      socket?.close(1000,'client disconnect');
      socket = null;
    },
  };
}
