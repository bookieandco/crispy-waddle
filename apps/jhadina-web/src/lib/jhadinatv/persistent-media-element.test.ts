import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPersistentMediaElement,
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

function element(): FakeElement {
  const node: FakeElement = {
    isConnected: true,
    parentElement: null,
    style: { display: '' },
    src: '',
    currentTime: 0,
    playsInline: false,
    controls: false,
    setAttribute() {},
    appendChild(child) {
      child.parentElement = node;
      child.isConnected = node.isConnected;
      return child;
    },
  };
  return node;
}

function installFakeDocument() {
  const body = element();
  const created = element();
  const documentStub = {
    body,
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => created),
  };
  vi.stubGlobal('document', documentStub);
  return { body, created };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent media element ownership', () => {
  it('does not let an older host release a newer host', () => {
    const { body } = installFakeDocument();
    const firstHost = element();
    const secondHost = element();

    const video = mountPersistentMediaElement(firstHost as unknown as HTMLElement);
    mountPersistentMediaElement(secondHost as unknown as HTMLElement);
    firstHost.isConnected = false;
    releasePersistentMediaElement(firstHost as unknown as HTMLElement);

    expect(video.parentElement).toBe(secondHost);
    expect(video.style.display).toBe('');
    expect(video.parentElement).not.toBe(body);
  });

  it('does not let stale same-host cleanup hide an active remount', () => {
    installFakeDocument();
    const host = element();

    mountPersistentMediaElement(host as unknown as HTMLElement);
    mountPersistentMediaElement(host as unknown as HTMLElement);
    releasePersistentMediaElement(host as unknown as HTMLElement);

    const video = getPersistentMediaElement();
    expect(video.parentElement).toBe(host);
    expect(video.style.display).toBe('');
  });

  it('does not allow hostless cleanup to steal an actively owned element', () => {
    const { body } = installFakeDocument();
    const host = element();

    const video = mountPersistentMediaElement(host as unknown as HTMLElement);
    releasePersistentMediaElement();

    expect(video.parentElement).toBe(host);
    expect(video.parentElement).not.toBe(body);
    expect(video.style.display).toBe('');
  });

  it('preserves media state while releasing an unmounted host', () => {
    const { body } = installFakeDocument();
    const host = element();
    const video = mountPersistentMediaElement(host as unknown as HTMLElement) as unknown as FakeElement;
    video.src = 'https://example.com/movie.m3u8';
    video.currentTime = 42.5;
    host.isConnected = false;
    video.isConnected = false;

    releasePersistentMediaElement(host as unknown as HTMLElement);

    expect(video.parentElement).toBe(body);
    expect(video.style.display).toBe('none');
    expect(video.src).toBe('https://example.com/movie.m3u8');
    expect(video.currentTime).toBe(42.5);
  });
});
