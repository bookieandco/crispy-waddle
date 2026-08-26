'use client';

export type LiveStudyView = {
  studyId: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  positionSeconds: number;
  observationsSeen: number;
  notesCreated: number;
  learningCandidatesCreated: number;
  notes: Array<{ id: string; body: string; kind: string; startSeconds?: number; endSeconds?: number }>;
};

export type LiveStudyPanelProps = {
  view?: LiveStudyView;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onOpenNotes?: () => void;
  onPromoteLearning?: () => void;
  onJumpToTime?: (seconds: number) => void;
};

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 3600).toString().padStart(2, '0')}:${Math.floor((total % 3600) / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

export function LiveStudyPanel({ view, onStart, onPause, onResume, onStop, onOpenNotes, onPromoteLearning, onJumpToTime }: LiveStudyPanelProps) {
  const status = view?.status ?? 'queued';
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${status === 'running' ? 'bg-emerald-400' : 'bg-white/30'}`} />
            <h2 className="text-lg font-semibold">Autonomous Study</h2>
          </div>
          <p className="mt-1 text-xs text-white/50">Jhadina watches, takes notes, and produces learning candidates while the study runs.</p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-white/70">{status}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ['Position', formatTime(view?.positionSeconds ?? 0)],
          ['Observations', String(view?.observationsSeen ?? 0)],
          ['Notes', String(view?.notesCreated ?? 0)],
          ['Learning', String(view?.learningCandidatesCreated ?? 0)],
          ['Study', view?.studyId ?? 'Not started'],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-black/20 p-3"><div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div><div className="mt-1 truncate text-sm text-white/85">{value}</div></div>)}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === 'running' ? <button onClick={onPause} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Pause</button> : <button onClick={status === 'paused' ? onResume : onStart} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black">{status === 'paused' ? 'Resume' : 'Start watching'}</button>}
        <button onClick={onStop} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70">Stop</button>
        <button onClick={onOpenNotes} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70">Open notes</button>
        <button onClick={onPromoteLearning} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70">Promote learning</button>
      </div>

      <div className="mt-4 max-h-72 space-y-2 overflow-auto">
        {(view?.notes ?? []).map(note => <button key={note.id} onClick={() => onJumpToTime?.(note.startSeconds ?? 0)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/5"><div className="flex justify-between text-[10px] uppercase tracking-wide text-white/35"><span>{note.kind}</span><span>{formatTime(note.startSeconds ?? 0)}</span></div><div className="mt-1 text-sm text-white/80">{note.body}</div></button>)}
        {!view?.notes?.length && <p className="text-sm text-white/35">No autonomous notes yet.</p>}
      </div>
    </section>
  );
}
