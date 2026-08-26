'use client';

import { useMemo, useRef, useState } from 'react';
import { LiveStudyPanel, type LiveStudyView } from './LiveStudyPanel';

type Note = {
  id: string;
  body: string;
  kind: string;
  startSeconds?: number;
  endSeconds?: number;
  tags: string[];
};

export type WatchNotebookProps = {
  sourceUrl?: string;
  title?: string;
  initialNotes?: Note[];
  liveStudy?: LiveStudyView;
  onStartStudy?: () => void;
  onPauseStudy?: () => void;
  onResumeStudy?: () => void;
  onStopStudy?: () => void;
  onOpenStudyNotes?: () => void;
  onPromoteLearning?: () => void;
};

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function WatchNotebook({ sourceUrl = '', title = 'Watch', initialNotes = [], liveStudy, onStartStudy, onPauseStudy, onResumeStudy, onStopStudy, onOpenStudyNotes, onPromoteLearning }: WatchNotebookProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(sourceUrl);
  const [currentTime, setCurrentTime] = useState(0);
  const [paused, setPaused] = useState(true);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [kind, setKind] = useState('general');

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => (a.startSeconds ?? 0) - (b.startSeconds ?? 0)), [notes]);

  function addNote() {
    const body = note.trim();
    if (!body) return;
    setNotes(items => [...items, { id: crypto.randomUUID(), body, kind, startSeconds: currentTime, tags: [] }]);
    setNote('');
  }

  function jump(seconds: number) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,.8fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center gap-2 border-b border-white/10 p-3">
            <input value={url} onChange={event => setUrl(event.target.value)} placeholder="Authorized HLS/MP4/DASH/local media URL" className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none" />
            <button onClick={() => videoRef.current?.load()} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Load</button>
          </div>
          <video ref={videoRef} src={url || undefined} controls playsInline className="aspect-video w-full bg-black" onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} />
          <div className="flex items-center justify-between p-3 text-sm text-white/60"><span>{title}</span><span>{formatTime(currentTime)} · {paused ? 'paused' : 'watching'}</span></div>
        </div>

        <aside className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-white/[.03]">
          <div className="border-b border-white/10 p-4"><h2 className="text-lg font-semibold">Cinematic Notebook</h2><p className="mt-1 text-xs text-white/50">Notes stay attached to the exact moment you are studying.</p></div>
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {sortedNotes.length === 0 && <p className="text-sm text-white/40">Pause on a moment worth studying and write the director note.</p>}
            {sortedNotes.map(item => <button key={item.id} onClick={() => jump(item.startSeconds ?? 0)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/5"><div className="mb-1 flex justify-between text-[11px] uppercase tracking-wide text-white/40"><span>{item.kind}</span><span>{formatTime(item.startSeconds ?? 0)}</span></div><p className="text-sm leading-5 text-white/85">{item.body}</p></button>)}
          </div>
          <div className="border-t border-white/10 p-4"><div className="mb-2 flex gap-2">{['general', 'shot', 'camera', 'edit', 'sound'].map(value => <button key={value} onClick={() => setKind(value)} className={`rounded-full px-2.5 py-1 text-xs ${kind === value ? 'bg-white text-black' : 'bg-white/5 text-white/60'}`}>{value}</button>)}</div><textarea value={note} onChange={event => setNote(event.target.value)} placeholder={`Note at ${formatTime(currentTime)}…`} className="h-24 w-full resize-none rounded-xl bg-black/30 p-3 text-sm outline-none" /><button onClick={addNote} className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Save timecoded note</button></div>
        </aside>
      </div>

      <LiveStudyPanel
        view={liveStudy}
        onStart={onStartStudy}
        onPause={onPauseStudy}
        onResume={onResumeStudy}
        onStop={onStopStudy}
        onOpenNotes={onOpenStudyNotes}
        onPromoteLearning={onPromoteLearning}
        onJumpToTime={jump}
      />
    </section>
  );
}
