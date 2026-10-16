import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
type Saved = { position_seconds: number; completed: boolean } | null;
/** Operational resume data only. Not an approval to train permanent preference memory. */
export function TVUserControls({ mediaId, videoRef }: {
  mediaId: string; videoRef: MutableRefObject<HTMLVideoElement | null>;
}) {
  const [saved, setSaved] = useState<Saved>(null);
  const [watchlisted, setWatchlisted] = useState(false);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const lastWrite = useRef(0);
  useEffect(() => {
    let active = true;
    setReady(false); setSaved(null); setNotice('');
    fetch(`/api/jhadinatv/state?mediaId=${encodeURIComponent(mediaId)}`, { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error('Continue Watching is not commissioned yet.');
        return response.json() as Promise<{ checkpoint: Saved; watchlisted: boolean }>;
      })
      .then(data => { if (active) { setSaved(data.checkpoint); setWatchlisted(data.watchlisted); setReady(true); } })
      .catch(error => { if (active) setNotice(error instanceof Error ? error.message : 'Viewing state unavailable'); });
    return () => { active = false; };
  }, [mediaId]);
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    if (!video) return;
    const persist = () => {
      if (!Number.isFinite(video.currentTime) || video.currentTime < 0) return;
      const now = Date.now();
      if (now - lastWrite.current < 15000 && !video.paused && !video.ended) return;
      lastWrite.current = now;
      void fetch('/api/jhadinatv/state', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkpoint', mediaId, positionSeconds: video.currentTime,
          durationSeconds: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null,
          observedAt: new Date(now).toISOString() }),
      }).then(response => { if (!response.ok) throw new Error('Resume could not be synced.'); })
        .catch(() => setNotice('Resume could not be synced.'));
    };
    for (const event of ['timeupdate', 'pause', 'ended']) video.addEventListener(event, persist);
    return () => { for (const event of ['timeupdate', 'pause', 'ended']) video.removeEventListener(event, persist); };
  }, [ready, mediaId, videoRef]);
  const toggleWatchlist = async () => {
    const next = !watchlisted;
    try {
      const response = await fetch('/api/jhadinatv/state', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'watchlist', mediaId, enabled: next }) });
      if (!response.ok) throw new Error('Watchlist storage unavailable');
      setWatchlisted(next); setNotice('');
    } catch { setNotice('Watchlist could not be saved.'); }
  };
  return <section style={{ marginTop: 14 }}>
    {ready && <button type="button" onClick={() => void toggleWatchlist()}>{watchlisted ? '✓ Remove from watchlist' : '+ Save to watchlist'}</button>}
    {ready && saved && !saved.completed && saved.position_seconds > 0 &&
      <button type="button" onClick={() => { if (videoRef.current) videoRef.current.currentTime = saved.position_seconds; }}
        style={{ marginLeft: 12 }}>Resume at {Math.floor(saved.position_seconds / 60)}m</button>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
