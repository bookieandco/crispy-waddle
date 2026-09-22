'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type VideoJob = {
  id: string;
  status: 'queued'|'submitted'|'generating'|'ingesting'|'preview_ready'|'blocked'|'failed'|'cancelled';
  currentPhase: string;
  error?: string;
  previewAssetId?: string;
};

type ReferenceCharacterVideoPanelProps = {
  projectId: string;
};

function characterSlug(value: string): string {
  return value
    .trim()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,64) || 'character';
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

export function ReferenceCharacterVideoPanel({ projectId }: ReferenceCharacterVideoPanelProps) {
  const [file,setFile] = useState<File|null>(null);
  const [displayName,setDisplayName] = useState('');
  const [characterId,setCharacterId] = useState('');
  const [archetype,setArchetype] = useState<'human'|'cartoon'|'puppet'|'creature'>('human');
  const [rightsConfirmed,setRightsConfirmed] = useState(false);
  const [prompt,setPrompt] = useState('');
  const [duration,setDuration] = useState(30);
  const [aspectRatio,setAspectRatio] = useState<'16:9'|'9:16'|'1:1'>('16:9');
  const [dialogueRequired,setDialogueRequired] = useState(false);
  const [busy,setBusy] = useState(false);
  const [stage,setStage] = useState('Ready');
  const [error,setError] = useState<string|null>(null);
  const [referenceAssetId,setReferenceAssetId] = useState<string|null>(null);
  const [lockedCharacterId,setLockedCharacterId] = useState<string|null>(null);
  const [videoJob,setVideoJob] = useState<VideoJob|null>(null);
  const [previewUrl,setPreviewUrl] = useState<string|null>(null);
  const pollAbort = useRef<AbortController|null>(null);

  const canStart = useMemo(() =>
    Boolean(
      projectId &&
      file &&
      displayName.trim() &&
      characterId.trim() &&
      rightsConfirmed &&
      prompt.trim() &&
      !busy
    ), [projectId,file,displayName,characterId,rightsConfirmed,prompt,busy]);

  useEffect(() => () => pollAbort.current?.abort(), []);

  function handleName(value: string) {
    setDisplayName(value);
    if (!lockedCharacterId) setCharacterId(characterSlug(value));
  }

  async function pollJob(jobId: string) {
    pollAbort.current?.abort();
    const controller = new AbortController();
    pollAbort.current = controller;

    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (controller.signal.aborted) return;
      const response = await fetch(`/api/director/video-jobs/${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await json<{ ok:boolean; job:VideoJob; previewUrl?:string|null }>(response);
      setVideoJob(data.job);
      setStage(`Video: ${data.job.currentPhase}`);

      if (data.job.status === 'preview_ready') {
        setPreviewUrl(data.previewUrl ?? null);
        setStage('Preview ready');
        return;
      }
      if (data.job.status === 'blocked' || data.job.status === 'failed' || data.job.status === 'cancelled') {
        throw new Error(data.job.error ?? `Video job ${data.job.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error('DIRECTOR_VIDEO_POLL_TIMEOUT');
  }

  async function createVideo() {
    if (!canStart || !file) return;
    setBusy(true);
    setError(null);
    setPreviewUrl(null);
    setVideoJob(null);
    setReferenceAssetId(null);
    setLockedCharacterId(null);

    try {
      setStage('Uploading reference');
      const form = new FormData();
      form.set('file',file);
      form.set('projectId',projectId);
      form.set('rightsRef',`user-attestation:${new Date().toISOString()}`);
      form.set('consentRef',`user-attestation:${new Date().toISOString()}`);
      form.set('viewHint','unknown');
      const uploaded = await json<{
        ok:boolean;
        asset:{id:string;admission_status:string;scan_status:string};
      }>(await fetch('/api/director/characters/references',{method:'POST',body:form}));
      setReferenceAssetId(uploaded.asset.id);

      setStage('Scanning and admitting reference');
      await json(await fetch(
        `/api/director/characters/references/${encodeURIComponent(uploaded.asset.id)}/admit`,
        {
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({projectId}),
        },
      ));

      setStage('Locking character identity');
      const bootstrap = await json<{
        ok:boolean;
        characterId:string;
        continuityRef:string;
        status:string;
      }>(await fetch('/api/director/characters/bootstrap',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          projectId,
          characterId:characterId.trim(),
          displayName:displayName.trim(),
          archetype,
          referenceAssetIds:[uploaded.asset.id],
          buildMotionProbes:true,
          commercialUse:true,
          lockedTraits:['preserve canonical face/body identity across the full video'],
        }),
      }));
      setLockedCharacterId(bootstrap.characterId);

      setStage('Submitting full video');
      const submitted = await json<{
        ok:boolean;
        videoJob:VideoJob;
      }>(await fetch('/api/director/videos/reference-character',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          projectId,
          characterId:bootstrap.characterId,
          prompt:prompt.trim(),
          targetDurationSeconds:duration,
          aspectRatio,
          mode: duration > 120 ? 'long-form' : 'standard',
          dialogueRequired,
          targetLanguages:['en'],
          clientRequestId:crypto.randomUUID(),
        }),
      }));
      setVideoJob(submitted.videoJob);
      await pollJob(submitted.videoJob.id);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Unable to create reference-character video');
      setStage('Blocked');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference character → full video</p>
          <h2 className="text-lg font-semibold">Create a movie from one character image</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            The image stays private. Director quarantines and scans it, locks the character identity, then only reference-aware video providers may render the character.
          </p>
        </div>
        <span className="rounded-full border px-2 py-1 text-xs">{stage}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs">
          Reference image
          <input
            className="mt-1 block w-full rounded border p-2 text-sm"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="text-xs">
          Character name
          <input
            className="mt-1 w-full rounded border p-2 text-sm"
            value={displayName}
            disabled={busy}
            placeholder="Ela"
            onChange={(event) => handleName(event.target.value)}
          />
        </label>
        <label className="text-xs">
          Character ID
          <input
            className="mt-1 w-full rounded border p-2 text-sm"
            value={characterId}
            disabled={busy || Boolean(lockedCharacterId)}
            placeholder="ela"
            onChange={(event) => setCharacterId(characterSlug(event.target.value))}
          />
        </label>
        <label className="text-xs">
          Character type
          <select
            className="mt-1 w-full rounded border p-2 text-sm"
            value={archetype}
            disabled={busy}
            onChange={(event) => setArchetype(event.target.value as typeof archetype)}
          >
            <option value="human">Human</option>
            <option value="cartoon">Cartoon</option>
            <option value="puppet">Puppet</option>
            <option value="creature">Creature</option>
          </select>
        </label>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={rightsConfirmed}
          disabled={busy}
          onChange={(event) => setRightsConfirmed(event.target.checked)}
        />
        <span>I own this reference or have permission/consent to use it for AI-generated video.</span>
      </label>

      <label className="mt-4 block text-xs">
        What should Director create?
        <textarea
          className="mt-1 min-h-28 w-full rounded border p-2 text-sm"
          value={prompt}
          disabled={busy}
          placeholder="Create a cinematic scene where Ela receives his first beekeeping suit, opens the package, puts it on, then walks toward the hives at sunset. Keep the same exact character identity in every shot."
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs">
          Duration (seconds)
          <input
            className="mt-1 w-full rounded border p-2 text-sm"
            type="number"
            min={5}
            max={3600}
            value={duration}
            disabled={busy}
            onChange={(event) => setDuration(Math.max(5,Math.min(3600,Number(event.target.value) || 30)))}
          />
        </label>
        <label className="text-xs">
          Aspect
          <select
            className="mt-1 w-full rounded border p-2 text-sm"
            value={aspectRatio}
            disabled={busy}
            onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs">
          <input
            type="checkbox"
            checked={dialogueRequired}
            disabled={busy}
            onChange={(event) => setDialogueRequired(event.target.checked)}
          />
          Character dialogue / lip sync
        </label>
      </div>

      <button
        className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={!canStart}
        onClick={() => void createVideo()}
      >
        {busy ? 'Director is working…' : 'Create full video'}
      </button>

      {referenceAssetId || lockedCharacterId || videoJob ? (
        <div className="mt-4 grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs md:grid-cols-3">
          <div><span className="text-muted-foreground">Reference</span><p className="break-all">{referenceAssetId ?? '—'}</p></div>
          <div><span className="text-muted-foreground">Character</span><p className="break-all">{lockedCharacterId ?? '—'}</p></div>
          <div><span className="text-muted-foreground">Video job</span><p className="break-all">{videoJob?.id ?? '—'} · {videoJob?.status ?? '—'}</p></div>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p> : null}

      {previewUrl ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium">Director preview</p>
          <video className="max-h-[560px] w-full rounded-lg border bg-black" src={previewUrl} controls playsInline />
        </div>
      ) : null}
    </section>
  );
}
