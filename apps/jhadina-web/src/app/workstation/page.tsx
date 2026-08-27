'use client';

import { useMemo, useRef, useState } from 'react';
import type { EditingAssetManifestEntry } from '@jhadina/director-core';
import { LiveGeneratedEditingAssetShelf } from '../../../components/workstation/LiveGeneratedEditingAssetShelf';
import { WorkstationTimeline } from '../../../components/workstation/WorkstationTimeline';
import type { EditableTimeline, TimelineClip, TimelineTrack } from '@jhadina/director-core/timeline-model';
import type { TimelineCommand } from '@jhadina/director-core/timeline-command';

type WorkstationPageProps = {
  searchParams: { projectId?: string };
};

type WorkstationClip = TimelineClip & { name: string; kind: 'video' | 'audio' };
type WorkstationTrack = TimelineTrack & { clips: WorkstationClip[] };

const DEFAULT_PROJECT_ID = 'demo-project';
const DURATION_SECONDS = 30;

function createInitialTracks(): WorkstationTrack[] {
  return [
    {
      id: 'video-1',
      name: 'Video',
      kind: 'video',
      clips: [
        { id: 'video-demo', trackId: 'video-1', startSeconds: 0, durationSeconds: 30, sourceId: 'demo-video', name: 'Main footage', kind: 'video', assetId: 'demo-video', effects: [], generativeRegions: [] },
      ],
      index: 0,
    },
    {
      id: 'audio-1',
      name: 'Audio',
      kind: 'audio',
      clips: [
        { id: 'audio-demo', trackId: 'audio-1', startSeconds: 0, durationSeconds: 30, sourceId: 'demo-audio', name: 'Main audio', kind: 'audio', assetId: 'demo-audio', effects: [], generativeRegions: [] },
      ],
      index: 1,
    },
  ];
}

function normalizeTracks(tracks: TimelineTrack[]): WorkstationTrack[] {
  return tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({
      ...clip,
      name: clip.id.startsWith('generated:') ? `Generated asset ${clip.assetId}` : clip.id,
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
  const projectId = searchParams.projectId?.trim() || DEFAULT_PROJECT_ID;
  const initialTracks = useMemo(() => createInitialTracks(), []);
  const [timelineTracks, setTimelineTracks] = useState<WorkstationTrack[]>(initialTracks);
  const [timelineKey, setTimelineKey] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<EditingAssetManifestEntry | null>(null);
  const [inserting, setInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);
  const timelineRef = useRef<EditableTimeline>(makeTimeline(projectId, initialTracks));

  function handleTimelineChange(snapshot: { tracks: WorkstationTrack[]; transitions: EditableTimeline['transitions']; markers: EditableTimeline['markers']; playheadSeconds: number; versions: EditableTimeline['versions'] }) {
    const next = { ...timelineRef.current, tracks: snapshot.tracks, transitions: snapshot.transitions, markers: snapshot.markers, playheadSeconds: snapshot.playheadSeconds, versions: snapshot.versions };
    timelineRef.current = next;
    setTimelineTracks(snapshot.tracks);
  }

  async function insertSelectedAsset() {
    if (!selectedAsset || inserting) return;
    setInserting(true);
    setInsertError(null);

    try {
      const startSeconds = typeof selectedAsset.startSeconds === 'number' ? selectedAsset.startSeconds : timelineRef.current.playheadSeconds;
      const requestedEnd = typeof selectedAsset.endSeconds === 'number' ? selectedAsset.endSeconds : startSeconds + 5;
      const endSeconds = Math.min(DURATION_SECONDS, Math.max(startSeconds + 0.1, requestedEnd));
      if (startSeconds >= DURATION_SECONDS) throw new Error('The selected asset starts at the end of the timeline.');

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
            approvalState: 'approved',
            ...selectedAsset.metadata,
          },
        },
      };

      const response = await fetch('/api/workstation/timeline/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timeline: timelineRef.current, command, approved: true }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; reason?: string; timeline?: EditableTimeline };
      if (!response.ok || !data.ok || !data.timeline) throw new Error(data.error ?? data.reason ?? 'Generated asset insertion failed.');

      timelineRef.current = data.timeline;
      setTimelineTracks(normalizeTracks(data.timeline.tracks));
      setTimelineKey(key => key + 1);
    } catch (error) {
      setInsertError(error instanceof Error ? error.message : 'Unable to insert generated asset.');
    } finally {
      setInserting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4">
      <header className="rounded-xl border bg-background p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">DirectorOS Workstation</p>
        <h1 className="text-2xl font-semibold">Edit project</h1>
        <p className="text-sm text-muted-foreground">Project: {projectId}</p>
      </header>

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
        durationSeconds={DURATION_SECONDS}
        tracks={timelineTracks}
        onTimelineChange={handleTimelineChange}
      />
    </main>
  );
}
