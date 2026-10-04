'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditingAssetManifestEntry } from '@jhadina/director-core';
import { LiveGeneratedEditingAssetShelf } from '../../../components/workstation/LiveGeneratedEditingAssetShelf';
import { WorkstationTimeline } from '../../../components/workstation/WorkstationTimeline';
import { ReferenceCharacterVideoPanel } from '../../../components/workstation/ReferenceCharacterVideoPanel';
import { WorkstationProjectInputs } from '../../../components/workstation/WorkstationProjectInputs';
import { WorkstationBusinessContext } from '../../../components/workstation/WorkstationBusinessContext';
import { WorkstationSocialScheduler } from '../../../components/workstation/WorkstationSocialScheduler';
import { WorkstationScreenplayProposals } from '../../../components/workstation/WorkstationScreenplayProposals';
import { WorkstationWatchStudy } from '../../../components/workstation/WorkstationWatchStudy';
import { WorkstationRoughCut } from '../../../components/workstation/WorkstationRoughCut';
import { WorkstationAudioPost } from '../../../components/workstation/WorkstationAudioPost';
import { WorkstationTakeSets } from '../../../components/workstation/WorkstationTakeSets';
import { WorkstationMediaStudy } from '../../../components/workstation/WorkstationMediaStudy';
import type { EditableTimeline, TimelineClip, TimelineTrack } from '@jhadina/director-core/timeline-model';
import type { TimelineCommand } from '@jhadina/director-core/timeline-command';

type WorkstationPageProps = {
  searchParams: { projectId?: string; durationSeconds?: string; aspectRatio?: string };
};

type WorkstationClip = TimelineClip & { name: string; kind: 'video' | 'audio' };
type WorkstationTrack = TimelineTrack & { clips: WorkstationClip[] };

const DURATION_SECONDS = 30;

function createInitialTracks(): WorkstationTrack[] {
  return [
    {
      id: 'video-1',
      name: 'Video',
      kind: 'video',
      clips: [],
      index: 0,
    },
    {
      id: 'audio-1',
      name: 'Audio',
      kind: 'audio',
      clips: [],
      index: 1,
    },
  ];
}

function normalizeTracks(tracks: TimelineTrack[]): WorkstationTrack[] {
  return tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({
      ...clip,
      name: clip.name ?? (clip.id.startsWith('generated:') ? `Generated asset ${clip.assetId}` : clip.id),
      kind: track.kind === 'audio' ? 'audio' : 'video',
    })),
  }));
}

function makeTimeline(projectId: string, tracks: WorkstationTrack[]): EditableTimeline {
  return {
    version: 1,
    projectId,
    fps: 30,
    width: 1920,
    height: 1080,
    durationSeconds: DURATION_SECONDS,
    playheadSeconds: 0,
    tracks,
    transitions: [],
    markers: [],
    versions: [],
  };
}

export default function WorkstationPage({ searchParams }: WorkstationPageProps) {
  const requestedProjectId = searchParams.projectId?.trim() || '';
  const requestedDuration = Number(searchParams.durationSeconds);
  const requestedDurationSeconds = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? Math.min(14400, requestedDuration)
    : undefined;
  const requestedAspectRatio = ['9:16','16:9','1:1'].includes(searchParams.aspectRatio ?? '')
    ? searchParams.aspectRatio as '9:16'|'16:9'|'1:1'
    : undefined;
  const initialTracks = useMemo(() => createInitialTracks(), []);
  const [projectId, setProjectId] = useState(requestedProjectId);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [timelineTracks, setTimelineTracks] = useState<WorkstationTrack[]>(initialTracks);
  const [timelineKey, setTimelineKey] = useState(0);
  const [timelineRevision, setTimelineRevision] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<EditingAssetManifestEntry | null>(null);
  const [inserting, setInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);
  const timelineRef = useRef<EditableTimeline>(makeTimeline(requestedProjectId, initialTracks));

  useEffect(() => {
    let cancelled = false;

    async function hydrateTimeline(nextProjectId: string) {
      let response = await fetch('/api/workstation/timeline?projectId=' + encodeURIComponent(nextProjectId), { cache: 'no-store' });
      let data = await response.json() as { ok?: boolean; revision?: number; timeline?: EditableTimeline; error?: string };

      if (response.status === 404) {
        response = await fetch('/api/workstation/timeline', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId: nextProjectId,
            expectedRevision: 0,
            mutationId: crypto.randomUUID(),
            ...(requestedDurationSeconds ? { durationSeconds: requestedDurationSeconds } : {}),
            ...(requestedAspectRatio ? { aspectRatio: requestedAspectRatio } : {}),
          }),
        });
        data = await response.json() as { ok?: boolean; revision?: number; timeline?: EditableTimeline; error?: string };
      }

      if (!response.ok || !data.ok || !data.timeline || !Number.isSafeInteger(data.revision)) {
        throw new Error(data.error ?? 'Unable to load Director timeline');
      }
      if (cancelled) return;

      timelineRef.current = data.timeline;
      setTimelineRevision(data.revision!);
      setTimelineTracks(normalizeTracks(data.timeline.tracks));
      setTimelineKey(key => key + 1);
      setProjectId(nextProjectId);
      setProjectError(null);
    }

    void (async () => {
      try {
        if (requestedProjectId) {
          await hydrateTimeline(requestedProjectId);
          return;
        }

        const response = await fetch('/api/workstation/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ defaultProject: true }),
        });
        const data = await response.json() as { ok?: boolean; projectId?: string; error?: string };
        if (!response.ok || !data.ok || !data.projectId) throw new Error(data.error ?? 'Unable to create Director project');
        await hydrateTimeline(data.projectId);
      } catch (error) {
        if (!cancelled) setProjectError(error instanceof Error ? error.message : 'Unable to create Director project');
      }
    })();

    return () => { cancelled = true; };
  }, [initialTracks, requestedAspectRatio, requestedDurationSeconds, requestedProjectId]);

  function handleTimelineChange(snapshot: { tracks: WorkstationTrack[]; transitions: EditableTimeline['transitions']; markers: EditableTimeline['markers']; playheadSeconds: number; versions: EditableTimeline['versions']; revision: number }) {
    const next = { ...timelineRef.current, tracks: snapshot.tracks, transitions: snapshot.transitions, markers: snapshot.markers, playheadSeconds: snapshot.playheadSeconds, versions: snapshot.versions };
    timelineRef.current = next;
    setTimelineRevision(snapshot.revision);
    setTimelineTracks(snapshot.tracks);
  }

  async function insertSelectedAsset() {
    if (!selectedAsset || inserting || !projectId) return;
    setInserting(true);
    setInsertError(null);

    try {
      const startSeconds = typeof selectedAsset.startSeconds === 'number' ? selectedAsset.startSeconds : timelineRef.current.playheadSeconds;
      const requestedEnd = typeof selectedAsset.endSeconds === 'number' ? selectedAsset.endSeconds : startSeconds + 5;
      const timelineDuration = timelineRef.current.durationSeconds;
      const endSeconds = Math.min(timelineDuration, Math.max(startSeconds + 0.1, requestedEnd));
      if (startSeconds >= timelineDuration) throw new Error('The selected asset starts at the end of the timeline.');

      const command: TimelineCommand = {
        type: 'insert-generated-asset',
        asset: {
          assetId: selectedAsset.assetId,
          generationJobId: selectedAsset.generationJobId,
          uri: selectedAsset.uri,
          mimeType: selectedAsset.mimeType,
          mediaType: selectedAsset.kind,
          operationId: selectedAsset.operationId,
          sourceId: selectedAsset.sourceId,
          startSeconds,
          endSeconds,
          metadata: {
            manifestEntryId: selectedAsset.assetId,
            ...selectedAsset.metadata,
          },
        },
      };

      const response = await fetch('/api/workstation/timeline/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, expectedRevision: timelineRevision, mutationId: crypto.randomUUID(), command }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; reason?: string; timeline?: EditableTimeline; revision?: number };
      if (!response.ok || !data.ok || !data.timeline || !Number.isSafeInteger(data.revision)) throw new Error(data.error ?? data.reason ?? 'Generated asset insertion failed.');

      timelineRef.current = data.timeline;
      setTimelineRevision(data.revision!);
      setTimelineTracks(normalizeTracks(data.timeline.tracks));
      setTimelineKey(key => key + 1);
    } catch (error) {
      setInsertError(error instanceof Error ? error.message : 'Unable to insert generated asset.');
    } finally {
      setInserting(false);
    }
  }

  if (!projectId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4">
        <header className="rounded-xl border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">DirectorOS Workstation</p>
          <h1 className="text-2xl font-semibold">Preparing project</h1>
          <p className={projectError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {projectError ?? 'Creating your owner-scoped Director project…'}
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4">
      <header className="rounded-xl border bg-background p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">DirectorOS Workstation</p>
        <h1 className="text-2xl font-semibold">Edit project</h1>
        <p className="text-sm text-muted-foreground">Project: {projectId}</p>
      </header>

      <WorkstationBusinessContext projectId={projectId} />

      <WorkstationProjectInputs projectId={projectId} />

      <WorkstationScreenplayProposals projectId={projectId} />

      <WorkstationRoughCut projectId={projectId} />

      <WorkstationTakeSets projectId={projectId} />

      <WorkstationAudioPost projectId={projectId} />

      <WorkstationWatchStudy />

      <WorkstationMediaStudy />

      <WorkstationSocialScheduler projectId={projectId} />

      <ReferenceCharacterVideoPanel projectId={projectId} />

      <section className="rounded-xl border bg-background p-4">
        <div className="mb-3">
          <h2 className="font-semibold">Generated editing assets</h2>
          <p className="text-xs text-muted-foreground">Persisted assets are retrieved by project and require explicit approval before use.</p>
        </div>
        <LiveGeneratedEditingAssetShelf projectId={projectId} onUseAsset={setSelectedAsset} />
        {selectedAsset ? (
          <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="font-medium">Selected for edit</p>
            <p>Job: {selectedAsset.generationJobId}</p>
            <p>Operation: {selectedAsset.operationId ?? '—'}</p>
            <p>URI: {selectedAsset.uri}</p>
            <p>MIME: {selectedAsset.mimeType}</p>
            <button className="mt-3 rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50" disabled={inserting} onClick={() => void insertSelectedAsset()}>{inserting ? 'Inserting…' : 'Insert into timeline'}</button>
            {insertError ? <p className="mt-2 text-destructive">{insertError}</p> : null}
          </div>
        ) : null}
      </section>

      <WorkstationTimeline
        key={timelineKey}
        projectId={projectId}
        durationSeconds={timelineRef.current.durationSeconds}
        tracks={timelineTracks}
        revision={timelineRevision}
        versions={timelineRef.current.versions}
        playheadSeconds={timelineRef.current.playheadSeconds}
        markers={timelineRef.current.markers}
        transitions={timelineRef.current.transitions}
        onTimelineChange={handleTimelineChange}
      />
    </main>
  );
}
