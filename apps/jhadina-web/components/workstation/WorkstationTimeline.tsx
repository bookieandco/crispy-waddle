'use client';

import { useMemo, useRef, useState } from 'react';
import { addTransition, setClipFade, splitClip, type FadeCurve } from '@jhadina/director-core/timeline-editing';
import type { EditableTimeline, TimelineClip, TimelineTrack, TimelineVersion, Transition } from '@jhadina/director-core/timeline-model';
import type { TimelineCommand } from '@jhadina/director-core/timeline-command';

type Clip = TimelineClip & { name: string; kind: 'video' | 'audio'; fade?: { fadeInSeconds: number; fadeOutSeconds: number; curve: FadeCurve } };
type Track = TimelineTrack & { clips: Clip[] };
type Marker = { id: string; timeSeconds: number; label: string };
type DragMode = 'move' | 'trim-start' | 'trim-end';
type HistoryCommand = TimelineCommand | { type: 'undo'; targetVersionId?: string } | { type: 'redo'; targetVersionId: string };

export type WorkstationTimelineProps = {
  projectId: string;
  durationSeconds: number;
  tracks: Track[];
  markers?: Marker[];
  transitions?: Transition[];
  onTimelineChange?: (timeline: { tracks: Track[]; transitions: Transition[]; markers: Marker[]; playheadSeconds: number; versions: TimelineVersion[] }) => void;
};

const PX_PER_SECOND = 90;
const MIN_CLIP_SECONDS = 0.1;
const SNAP_SECONDS = 0.1;

function snap(seconds: number) { return Math.round(seconds / SNAP_SECONDS) * SNAP_SECONDS; }

function initialTimeline(projectId: string, durationSeconds: number, tracks: Track[], markers: Marker[], transitions: Transition[]): EditableTimeline {
  return { version: 1, projectId, fps: 30, width: 1920, height: 1080, durationSeconds, playheadSeconds: 0, tracks, transitions, markers, versions: [] };
}

export function WorkstationTimeline({ projectId, durationSeconds, tracks: initialTracks, markers = [], transitions: initialTransitions = [], onTimelineChange }: WorkstationTimelineProps) {
  const [timeline, setTimeline] = useState<EditableTimeline>(() => initialTimeline(projectId, durationSeconds, initialTracks, markers, initialTransitions));
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [approval, setApproval] = useState<{ status: 'idle' | 'pending' | 'approved' | 'rejected'; regionId?: string }>({ status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const dragRef = useRef<{ clipId: string; trackId: string; mode: DragMode; startX: number; originalStart: number; originalDuration: number } | null>(null);

  const tracks = timeline.tracks as Track[];
  const transitions = timeline.transitions;
  const selectedClip = useMemo(() => tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) ?? null, [tracks, selectedClipId]);
  const timelineWidth = Math.max(durationSeconds * PX_PER_SECOND, 900);
  const currentVersion = timeline.versions.at(-1);
  const canUndo = Boolean(currentVersion?.parentVersionId);
  const canRedo = redoStack.length > 0;

  function publish(next: EditableTimeline) {
    setTimeline(next);
    onTimelineChange?.({ tracks: next.tracks as Track[], transitions: next.transitions, markers: next.markers as Marker[], playheadSeconds: next.playheadSeconds, versions: next.versions });
  }

  async function dispatch(command: HistoryCommand, options?: { clearRedo?: boolean; recordRedoVersionId?: string }) {
    if (busy) return null;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/workstation/timeline/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timeline, command, approved: command.type !== 'generative-region' || approval.status === 'approved' }),
      });
      const data = await response.json() as { ok?: boolean; status?: string; error?: string; reason?: string; timeline?: EditableTimeline };
      if (!response.ok || !data.ok || !data.timeline) {
        setError(data.error ?? data.reason ?? `Timeline command ${data.status ?? 'failed'}`);
        return null;
      }
      publish(data.timeline);
      if (options?.clearRedo !== false && command.type !== 'undo' && command.type !== 'redo') setRedoStack([]);
      if (options?.recordRedoVersionId) setRedoStack(stack => [...stack, options.recordRedoVersionId!]);
      return data.timeline;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reach the timeline command endpoint.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  function previewClip(clipId: string, patch: Partial<Clip>) {
    setTimeline(current => ({ ...current, tracks: current.tracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip) })) }));
  }

  function pointerDown(event: React.PointerEvent, clip: Clip, mode: DragMode) {
    if (selectedClip?.id !== clip.id) setSelectedClipId(clip.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { clipId: clip.id, trackId: clip.trackId, mode, startX: event.clientX, originalStart: clip.startSeconds, originalDuration: clip.durationSeconds };
  }

  function pointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = (event.clientX - drag.startX) / PX_PER_SECOND;
    if (drag.mode === 'move') {
      previewClip(drag.clipId, { startSeconds: snap(Math.max(0, drag.originalStart + delta)) });
    } else if (drag.mode === 'trim-start') {
      const nextStart = snap(Math.max(0, Math.min(drag.originalStart + drag.originalDuration - MIN_CLIP_SECONDS, drag.originalStart + delta)));
      previewClip(drag.clipId, { startSeconds: nextStart, durationSeconds: drag.originalDuration + drag.originalStart - nextStart });
    } else {
      previewClip(drag.clipId, { durationSeconds: snap(Math.max(MIN_CLIP_SECONDS, drag.originalDuration + delta)) });
    }
  }

  async function pointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const clip = timeline.tracks.flatMap(track => track.clips).find(item => item.id === drag.clipId);
    if (!clip) return;
    if (drag.mode === 'move') await dispatch({ type: 'move', clipId: drag.clipId, startSeconds: clip.startSeconds });
    if (drag.mode === 'trim-start' || drag.mode === 'trim-end') await dispatch({ type: 'trim', clipId: drag.clipId, startSeconds: clip.startSeconds, durationSeconds: clip.durationSeconds });
  }

  async function splitAtPlayhead() {
    if (!selectedClip) return;
    await dispatch({ type: 'split', clipId: selectedClip.id, atSeconds: playheadSeconds });
  }

  async function rippleDelete() {
    if (!selectedClip) return;
    await dispatch({ type: 'ripple-delete', clipId: selectedClip.id });
    setSelectedClipId(null);
  }

  async function applyFade(kind: 'in' | 'out') {
    if (!selectedClip) return;
    const command: TimelineCommand = { type: 'fade', clipId: selectedClip.id, [kind === 'in' ? 'fadeInSeconds' : 'fadeOutSeconds']: Math.min(2, selectedClip.durationSeconds / 2), curve: 'equal-power' };
    await dispatch(command);
  }

  async function applyCrossfade() {
    if (!selectedClip) return;
    const sameTrack = tracks.find(t => t.id === selectedClip.trackId);
    const nextClip = sameTrack?.clips.filter(c => c.id !== selectedClip.id).sort((a, b) => a.startSeconds - b.startSeconds).find(c => c.startSeconds >= selectedClip.startSeconds + selectedClip.durationSeconds - 0.001);
    if (!nextClip) return;
    await dispatch({ type: 'transition', transition: { id: `xfade-${selectedClip.id}-${nextClip.id}`, fromClipId: selectedClip.id, toClipId: nextClip.id, type: 'cross-dissolve', durationSeconds: 0.5 } });
  }

  async function setClipNumber(type: 'set-volume' | 'set-opacity', value: number) {
    if (!selectedClip || !Number.isFinite(value)) return;
    await dispatch({ type, clipId: selectedClip.id, [type === 'set-volume' ? 'volume' : 'opacity']: value } as TimelineCommand);
  }

  async function undo() {
    const current = timeline.versions.at(-1);
    if (!current?.parentVersionId) return;
    const result = await dispatch({ type: 'undo', targetVersionId: current.parentVersionId }, { clearRedo: false, recordRedoVersionId: current.id });
    if (result) setRedoStack(stack => stack.filter(id => id !== current.id));
  }

  async function redo() {
    const targetVersionId = redoStack.at(-1);
    if (!targetVersionId) return;
    const result = await dispatch({ type: 'redo', targetVersionId }, { clearRedo: false });
    if (result) setRedoStack(stack => stack.slice(0, -1));
  }

  async function askJhadina() {
    if (!selectedClip || !prompt.trim()) return;
    setApproval({ status: 'pending' });
    const response = await fetch('/api/workstation/timeline/generative-region', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, clipId: selectedClip.id, startSeconds: playheadSeconds, durationSeconds: Math.max(0.1, Math.min(selectedClip.durationSeconds, durationSeconds - playheadSeconds)), instruction: prompt.trim() }) });
    const data = await response.json();
    if (!response.ok) { setApproval({ status: 'rejected' }); return; }
    setApproval({ status: 'pending', regionId: data.region.id });
  }

  return <section className="flex min-h-[700px] flex-col overflow-hidden rounded-xl border bg-background select-none">
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div><h2 className="font-semibold">DirectorOS Timeline</h2><p className="text-xs text-muted-foreground">Governed edits • versioned history • drag previews commit on release</p></div>
      <div className="flex items-center gap-2 text-sm"><span>Playhead {playheadSeconds.toFixed(2)}s</span><button className="rounded border px-2 py-1" disabled={busy} onClick={() => setPlayheadSeconds(Math.max(0, playheadSeconds - 1))}>−</button><button className="rounded border px-2 py-1" disabled={busy} onClick={() => setPlayheadSeconds(Math.min(durationSeconds, playheadSeconds + 1))}>+</button><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={!canUndo || busy} onClick={undo}>Undo</button><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={!canRedo || busy} onClick={redo}>Redo</button></div>
    </div>

    {error ? <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div> : null}

    <div className="grid flex-1 grid-cols-[160px_1fr] overflow-auto touch-pan-x touch-pan-y"><div className="sticky left-0 z-10 bg-background/95"><div className="h-9 border-b px-3 py-2 text-xs text-muted-foreground">TRACKS</div>{tracks.map(track => <div key={track.id} className="flex h-20 items-center gap-2 border-b px-3 text-sm"><span className="font-medium">{track.name}</span><span className="ml-auto text-[10px] uppercase text-muted-foreground">{track.kind}</span></div>)}</div><div className="relative" style={{ width: timelineWidth }}><div className="sticky top-0 z-20 h-9 border-b bg-background/95" onPointerDown={e => { const rect = e.currentTarget.getBoundingClientRect(); const nextPlayhead = snap(Math.max(0, Math.min(durationSeconds, (e.clientX - rect.left) / PX_PER_SECOND))); setPlayheadSeconds(nextPlayhead); setTimeline(current => ({ ...current, playheadSeconds: nextPlayhead })); }}>{Array.from({ length: Math.ceil(durationSeconds) + 1 }, (_, i) => <span key={i} className="absolute top-2 text-[10px] text-muted-foreground" style={{ left: i * PX_PER_SECOND }}>{i}s</span>)}</div><div className="absolute inset-x-0 top-9 bottom-0">{markers.map(marker => <div key={marker.id} className="absolute top-0 z-30 h-full border-l border-dashed" style={{ left: marker.timeSeconds * PX_PER_SECOND }} title={marker.label} />)}{tracks.map(track => <div key={track.id} className="relative h-20 border-b">{track.clips.map(clip => <div key={clip.id} onPointerDown={e => pointerDown(e, clip, 'move')} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={() => setSelectedClipId(clip.id)} className={`absolute top-2 h-16 overflow-hidden rounded-md border px-2 text-left text-xs touch-none ${selectedClipId === clip.id ? 'ring-2 ring-primary' : ''}`} style={{ left: clip.startSeconds * PX_PER_SECOND, width: Math.max(28, clip.durationSeconds * PX_PER_SECOND), opacity: clip.opacity ?? 1 }}><button aria-label="Trim start" className="absolute inset-y-0 left-0 z-20 w-3 cursor-ew-resize" onPointerDown={e => { e.stopPropagation(); pointerDown(e, clip, 'trim-start'); }} /><button aria-label="Trim end" className="absolute inset-y-0 right-0 z-20 w-3 cursor-ew-resize" onPointerDown={e => { e.stopPropagation(); pointerDown(e, clip, 'trim-end'); }} /><span className="font-medium">{clip.name}</span><span className="block opacity-60">{clip.durationSeconds.toFixed(1)}s</span>{clip.fade?.fadeInSeconds ? <span className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background/70 to-transparent" /> : null}{clip.fade?.fadeOutSeconds ? <span className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background/70 to-transparent" /> : null}</div>)}</div>)}<div className="pointer-events-none absolute top-0 z-40 h-full border-l-2 border-red-500" style={{ left: playheadSeconds * PX_PER_SECOND }} /></div></div></div>

    <aside className="grid gap-4 border-t p-4 lg:grid-cols-[1fr_360px]">
      <div>{selectedClip ? <><h3 className="font-semibold">Clip Inspector</h3><div className="mt-2 grid grid-cols-2 gap-2 text-sm"><label>Start<input className="w-full rounded border p-1" type="number" step="0.1" value={selectedClip.startSeconds} onChange={e => previewClip(selectedClip.id, { startSeconds: Math.max(0, Number(e.target.value)) })} onBlur={() => void dispatch({ type: 'move', clipId: selectedClip.id, startSeconds: selectedClip.startSeconds })} /></label><label>Duration<input className="w-full rounded border p-1" type="number" step="0.1" value={selectedClip.durationSeconds} onChange={e => previewClip(selectedClip.id, { durationSeconds: Math.max(MIN_CLIP_SECONDS, Number(e.target.value)) })} onBlur={() => void dispatch({ type: 'trim', clipId: selectedClip.id, startSeconds: selectedClip.startSeconds, durationSeconds: selectedClip.durationSeconds })} /></label><label>Volume<input className="w-full rounded border p-1" type="number" step="0.01" min="0" max="2" value={selectedClip.volume ?? 1} onChange={e => void setClipNumber('set-volume', Number(e.target.value))} /></label><label>Opacity<input className="w-full rounded border p-1" type="number" step="0.01" min="0" max="1" value={selectedClip.opacity ?? 1} onChange={e => void setClipNumber('set-opacity', Number(e.target.value))} /></label></div><div className="mt-4 flex flex-wrap gap-2"><button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => void applyFade('in')}>Fade In</button><button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => void applyFade('out')}>Fade Out</button><button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => void applyCrossfade()}>Cross Dissolve</button><button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => void splitAtPlayhead()}>Split at Playhead</button><button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => void rippleDelete()}>Ripple Delete</button></div></> : <p className="text-sm text-muted-foreground">Select a clip to open governed NLE controls.</p>}</div>

      <div className="rounded-lg border p-3"><div className="flex items-center justify-between"><h3 className="font-semibold">History</h3><span className="text-xs text-muted-foreground">v{currentVersion?.version ?? 0}</span></div><div className="mt-2 max-h-48 space-y-1 overflow-auto">{[...timeline.versions].reverse().map(version => <div key={version.id} className={`rounded border px-2 py-1.5 text-xs ${version.id === currentVersion?.id ? 'ring-1 ring-primary' : ''}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">v{version.version} · {version.message}</span><span className="text-muted-foreground">{new Date(version.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>{version.revertsVersionId ? <div className="mt-0.5 text-muted-foreground">reverts {timeline.versions.find(v => v.id === version.revertsVersionId)?.version ?? '?'}</div> : null}{version.restoresVersionId ? <div className="mt-0.5 text-muted-foreground">restores {timeline.versions.find(v => v.id === version.restoresVersionId)?.version ?? '?'}</div> : null}</div>)}</div></div>

      <div className="rounded-lg border p-3 lg:col-span-2"><h3 className="font-semibold">Ask Jhadina to edit this region</h3><textarea className="mt-2 min-h-20 w-full rounded border p-2 text-sm" placeholder="Remove, replace, extend, reframe, make funnier, etc." value={prompt} onChange={e => setPrompt(e.target.value)} /><button className="mt-2 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={!prompt.trim() || approval.status === 'pending'} onClick={askJhadina}>{approval.status === 'pending' ? 'Awaiting approval…' : 'Create generative edit'}</button>{approval.regionId && <p className="mt-2 text-xs text-muted-foreground">Generative region {approval.regionId} is pending approval. The source clip remains unchanged.</p>}</div>
    </aside>
  </section>;
}
