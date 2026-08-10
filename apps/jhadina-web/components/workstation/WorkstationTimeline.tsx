'use client';

import { useMemo, useState } from 'react';

type Clip = { id: string; name: string; startSeconds: number; durationSeconds: number; kind: 'video' | 'audio'; trackId: string; assetId: string };
type Track = { id: string; name: string; kind: 'video' | 'audio'; clips: Clip[]; muted?: boolean; solo?: boolean; locked?: boolean };
type Marker = { id: string; timeSeconds: number; label: string };

export type WorkstationTimelineProps = {
  projectId: string;
  durationSeconds: number;
  tracks: Track[];
  markers?: Marker[];
  onTimelineChange?: (timeline: { tracks: Track[]; playheadSeconds: number }) => void;
};

const PX_PER_SECOND = 90;

export function WorkstationTimeline({ projectId, durationSeconds, tracks: initialTracks, markers = [], onTimelineChange }: WorkstationTimelineProps) {
  const [tracks, setTracks] = useState(initialTracks);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [approval, setApproval] = useState<{ status: 'idle' | 'pending' | 'approved' | 'rejected'; regionId?: string }>({ status: 'idle' });

  const selectedClip = useMemo(() => tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) ?? null, [tracks, selectedClipId]);
  const timelineWidth = Math.max(durationSeconds * PX_PER_SECOND, 900);

  function updateTracks(next: Track[]) { setTracks(next); onTimelineChange?.({ tracks: next, playheadSeconds }); }

  function moveClip(clipId: string, deltaSeconds: number) {
    updateTracks(tracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === clipId ? { ...clip, startSeconds: Math.max(0, clip.startSeconds + deltaSeconds) } : clip) })));
  }

  async function askJhadina() {
    if (!selectedClip || !prompt.trim()) return;
    setApproval({ status: 'pending' });
    const response = await fetch('/api/workstation/timeline/generative-region', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, clipId: selectedClip.id, startSeconds: playheadSeconds, durationSeconds: Math.max(0.1, Math.min(selectedClip.durationSeconds, durationSeconds - playheadSeconds)), instruction: prompt.trim() })
    });
    const data = await response.json();
    if (!response.ok) { setApproval({ status: 'rejected' }); return; }
    setApproval({ status: 'pending', regionId: data.region.id });
  }

  return (
    <section className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div><h2 className="font-semibold">DirectorOS Timeline</h2><p className="text-xs text-muted-foreground">{selectedClip ? `Selected: ${selectedClip.name}` : 'Select a clip to edit'}</p></div>
        <div className="flex items-center gap-2 text-sm"><span>Playhead {playheadSeconds.toFixed(2)}s</span><button className="rounded border px-2 py-1" onClick={() => setPlayheadSeconds(Math.max(0, playheadSeconds - 1))}>−</button><button className="rounded border px-2 py-1" onClick={() => setPlayheadSeconds(Math.min(durationSeconds, playheadSeconds + 1))}>+</button></div>
      </div>

      <div className="grid flex-1 grid-cols-[180px_1fr] overflow-auto">
        <div className="sticky left-0 z-10 bg-background/95 backdrop-blur">
          <div className="h-9 border-b px-3 py-2 text-xs text-muted-foreground">TRACKS</div>
          {tracks.map(track => <div key={track.id} className="flex h-20 items-center gap-2 border-b px-3 text-sm"><span className="font-medium">{track.name}</span><span className="ml-auto text-[10px] uppercase text-muted-foreground">{track.kind}</span></div>)}
        </div>
        <div className="relative" style={{ width: timelineWidth }}>
          <div className="sticky top-0 z-20 h-9 border-b bg-background/95" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setPlayheadSeconds(Math.max(0, Math.min(durationSeconds, (e.clientX - rect.left) / PX_PER_SECOND))); }}>
            {Array.from({ length: Math.ceil(durationSeconds) + 1 }, (_, i) => <span key={i} className="absolute top-2 text-[10px] text-muted-foreground" style={{ left: i * PX_PER_SECOND }}>{i}s</span>)}
          </div>
          <div className="absolute inset-x-0 top-9 bottom-0">
            {markers.map(marker => <div key={marker.id} className="absolute top-0 z-30 h-full border-l border-dashed" style={{ left: marker.timeSeconds * PX_PER_SECOND }} title={marker.label} />)}
            {tracks.map(track => <div key={track.id} className="relative h-20 border-b">
              {track.clips.map(clip => <button key={clip.id} onClick={() => setSelectedClipId(clip.id)} onDoubleClick={() => moveClip(clip.id, 1)} className={`absolute top-2 h-16 rounded-md border px-2 text-left text-xs ${selectedClipId === clip.id ? 'ring-2 ring-primary' : ''}`} style={{ left: clip.startSeconds * PX_PER_SECOND, width: Math.max(24, clip.durationSeconds * PX_PER_SECOND) }} title="Double-click to nudge right 1 second">
                <span className="font-medium">{clip.name}</span><span className="block opacity-60">{clip.durationSeconds.toFixed(1)}s</span>
              </button>)}
            </div>)}
            <div className="pointer-events-none absolute top-0 z-40 h-full border-l-2 border-red-500" style={{ left: playheadSeconds * PX_PER_SECOND }} />
          </div>
        </div>
      </div>

      <aside className="border-t p-4">
        {selectedClip ? <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          <div><h3 className="font-semibold">Clip Inspector</h3><div className="mt-2 grid grid-cols-2 gap-2 text-sm"><label>Start <input className="w-full rounded border p-1" type="number" step="0.01" value={selectedClip.startSeconds} onChange={e => moveClip(selectedClip.id, Number(e.target.value) - selectedClip.startSeconds)} /></label><label>Duration <input className="w-full rounded border p-1" type="number" step="0.01" value={selectedClip.durationSeconds} onChange={e => updateTracks(tracks.map(t => ({ ...t, clips: t.clips.map(c => c.id === selectedClip.id ? { ...c, durationSeconds: Math.max(0.1, Number(e.target.value)) } : c) }))) } /></label></div></div>
          <div className="rounded-lg border p-3"><h3 className="font-semibold">Ask Jhadina to edit this region</h3><textarea className="mt-2 min-h-20 w-full rounded border p-2 text-sm" placeholder="e.g. remove the background person and keep the camera movement identical" value={prompt} onChange={e => setPrompt(e.target.value)} /><button className="mt-2 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={!prompt.trim() || approval.status === 'pending'} onClick={askJhadina}>{approval.status === 'pending' ? 'Awaiting approval…' : 'Create generative edit'}</button>{approval.regionId && <p className="mt-2 text-xs text-muted-foreground">Generative region {approval.regionId} is pending approval. The source clip remains unchanged.</p>}</div>
        </div> : <p className="text-sm text-muted-foreground">Select a video or audio clip to open its inspector and Jhadina edit controls.</p>}
      </aside>
    </section>
  );
}
