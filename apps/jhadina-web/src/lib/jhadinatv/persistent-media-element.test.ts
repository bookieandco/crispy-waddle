import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPersistentMediaElement,
  getPersistentMediaElementOwnerToken,
  mountPersistentMediaElement,
  releasePersistentMediaElement,
} from './media-playback-runtime';

type FakeElement = {
  isConnected: boolean;
  parentElement: FakeElement | null;
  style: { display: string };
  src: string;
  currentTime: number;
  playsInline: boolean;
  controls: boolean;
  setAttribute(name: string, value: string): void;
  appendChild(child: FakeElement): FakeElement;
};
function element(): FakeElement { const node: FakeElement = { isConnected: true, parentElement: null, style: { display: '' }, src: '', currentTime: 0, playsInline: false, controls: false, setAttribute() {}, appendChild(child) { child.parentElement = node; child.isConnected = node.isConnected; return child; } }; return node; }
function installFakeDocument() { const body = element(); const created = element(); vi.stubGlobal('document', { body, querySelector: vi.fn(() => null), createElement: vi.fn(() => created) }); return { body, created }; }
afterEach(() => vi.unstubAllGlobals());

describe('persistent media element ownership', () => {
  it('rejects stale cleanup after a newer mount takes ownership', () => {
    installFakeDocument(); const firstHost = element(); const secondHost = element();
    const video = mountPersistentMediaElement(firstHost as unknown as HTMLElement); const firstToken = getPersistentMediaElementOwnerToken();
    mountPersistentMediaElement(secondHost as unknown as HTMLElement); const secondToken = getPersistentMediaElementOwnerToken();
    firstHost.isConnected = false; releasePersistentMediaElement(firstHost as unknown as HTMLElement, firstToken ?? undefined);
    expect(firstToken).not.toBe(secondToken); expect(video.parentElement).toBe(secondHost); expect(video.style.display).toBe('');
  });

  it('allows a route cleanup to release its mount before React removes the host', () => {
    const { body } = installFakeDocument(); const host = element();
    const video = mountPersistentMediaElement(host as unknown as HTMLElement); const token = getPersistentMediaElementOwnerToken();
    releasePersistentMediaElement(host as unknown as HTMLElement, token ?? undefined);
    expect(video.parentElement).toBe(body); expect(video.style.display).toBe('none'); expect(getPersistentMediaElementOwnerToken()).toBeNull();
  });

  it('does not allow hostless cleanup to steal an actively owned element', () => {
    const { body } = installFakeDocument(); const host = element(); const video = mountPersistentMediaElement(host as unknown as HTMLElement);
    releasePersistentMediaElement(); expect(video.parentElement).toBe(host); expect(video.parentElement).not.toBe(body); expect(video.style.display).toBe('');
  });

  it('preserves media state across release and later remount', () => {
    installFakeDocument(); const firstHost = element(); const secondHost = element();
    const video = mountPersistentMediaElement(firstHost as unknown as HTMLElement) as unknown as FakeElement;
    const token = getPersistentMediaElementOwnerToken(); video.src = 'https://example.com/movie.m3u8'; video.currentTime = 42.5;
    releasePersistentMediaElement(firstHost as unknown as HTMLElement, token ?? undefined);
    const remounted = mountPersistentMediaElement(secondHost as unknown as HTMLElement) as unknown as FakeElement;
    expect(remounted).toBe(video); expect(remounted.parentElement).toBe(secondHost); expect(remounted.src).toBe('https://example.com/movie.m3u8'); expect(remounted.currentTime).toBe(42.5); expect(remounted.style.display).toBe('');
  });
});
