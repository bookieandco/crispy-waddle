export type WatchSourceKind = 'local-file' | 'hls' | 'dash' | 'rtsp' | 'capture' | 'authorized-stream';

export type WatchSource = {
  id: string;
  title: string;
  kind: WatchSourceKind;
  url: string;
  subtitleUrl?: string;
  authorizationRequired?: boolean;
};

export type WatchBookmark = {
  id: string;
  sourceId: string;
  startSeconds: number;
  endSeconds?: number;
  note?: string;
  createdAt: string;
};

export type WatchSession = {
  id: string;
  source: WatchSource;
  startedAt: string;
  currentTimeSeconds: number;
  paused: boolean;
  bookmarks: WatchBookmark[];
};

export function createWatchSession(source: WatchSource, id: string, now = new Date().toISOString()): WatchSession {
  return {
    id,
    source,
    startedAt: now,
    currentTimeSeconds: 0,
    paused: true,
    bookmarks: [],
  };
}

export function addWatchBookmark(session: WatchSession, bookmark: Omit<WatchBookmark, 'sourceId' | 'createdAt'>, now = new Date().toISOString()): WatchSession {
  return {
    ...session,
    bookmarks: [...session.bookmarks, { ...bookmark, sourceId: session.source.id, createdAt: now }],
  };
}
