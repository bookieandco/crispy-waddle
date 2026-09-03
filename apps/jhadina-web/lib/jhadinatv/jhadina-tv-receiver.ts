import type { JhadinaTVReceiverTransport, MediaSessionCommand, MediaSessionState, PlaybackTarget, ResolvedPlaybackSource } from '@jhadina/tv-core';
import { assertCastablePlayback } from '@jhadina/tv-core';

interface ReceiverDescriptor { id: string; name: string; url: string; }

export function createJhadinaTVReceiverTransport(discoveryUrl = '/api/jhadinatv/receivers'): JhadinaTVReceiverTransport {
  let socket: WebSocket | null = null;
  let current: PlaybackTarget | undefined;
  let state: MediaSessionState | null = null;
  async function discover(): Promise<PlaybackTarget[]> {
    const response = await fetch(discoveryUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`JhadinaTV receiver discovery failed (${response.status}).`);
    const receivers = (await response.json()) as ReceiverDescriptor[];
    return receivers.map((receiver) => ({ id: receiver.id, name: receiver.name, transport: 'jhadinatv-tv' as const }));
  }
  async function connect(target: PlaybackTarget): Promise<void> {
    if (!target.id) throw new Error('JhadinaTV receiver target has no id.');
    const response = await fetch(discoveryUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Receiver discovery failed (${response.status}).`);
    const receivers = await response.json() as ReceiverDescriptor[];
    const receiver = receivers.find((candidate) => candidate.id === target.id);
    if (!receiver) throw new Error('Selected JhadinaTV receiver is no longer available.');
    await new Promise<void>((resolve, reject) => {
      socket = new WebSocket(receiver.url);
      socket.onopen = () => { current = target; resolve(); };
      socket.onerror = () => reject(new Error('Unable to connect to the JhadinaTV receiver.'));
      socket.onmessage = (event) => { try { const message = JSON.parse(event.data) as { state?: MediaSessionState }; if (message.state) state = message.state; } catch { /* Ignore malformed receiver messages. */ } };
      socket.onclose = () => { socket = null; current = undefined; };
    });
  }
  async function send(command: MediaSessionCommand): Promise<void> {
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('JhadinaTV receiver is not connected.');
    socket.send(JSON.stringify({ type: 'command', command }));
  }
  return {
    discover,
    connect,
    async load(playback: ResolvedPlaybackSource, positionSeconds) {
      assertCastablePlayback(playback);
      await send({ type: 'transfer', target: current });
      await send({ type: 'seek', value: positionSeconds });
      state = state ? { ...state, sourceUrl: playback.source.url, positionSeconds, target: current } : state;
    },
    send,
    async state() { return state; },
    async disconnect() { if (socket) socket.close(1000, 'client disconnect'); socket = null; current = undefined; },
  };
}
