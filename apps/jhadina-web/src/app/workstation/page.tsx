'use client';

import { useMemo, useState } from 'react';
import type { EditingAssetManifestEntry } from '@jhadina/director-core';
import { LiveGeneratedEditingAssetShelf } from '../../../components/workstation/LiveGeneratedEditingAssetShelf';
import { WorkstationTimeline } from '../../../components/workstation/WorkstationTimeline';
import type { TimelineClip, TimelineTrack } from '@jhadina/director-core/timeline-model';

type WorkstationPageProps = {
  searchParams: { projectId?: string };
};

const DEFAULT_PROJECT_ID = 'demo-project';

function createInitialTracks(): (TimelineTrack & { clips: Array<TimelineClip & { name: string; kind: 'video' | 'audio' }> })[] {
  return [
    {
      id: 'video-1',
      name: 'Video',
      kind: 'video',
      clips: [
        { id: 'video-demo', trackId: 'video-1', startSeconds: 0, durationSeconds: 30, sourceId: 'demo-video', name: 'Main footage', kind: 'video' },
      ],
    },
    {
      id: 'audio-1',
      name: 'Audio',
      kind: 'audio',
      clips: [
        { id: 'audio-demo', trackId: 'audio-1', startSeconds: 0, durationSeconds: 30, sourceId: 'demo-audio', name: 'Main audio', kind: 'audio' },
      ],
    },
  ];
}

export default function WorkstationPage({ searchParams }: WorkstationPageProps) {
  const projectId = searchParams.projectId?.trim() || DEFAULT_PROJECT_ID;
  const initialTracks = useMemo(() => createInitialTracks(), []);
  const [selectedAsset, setSelectedAsset] = useState<EditingAssetManifestEntry | null>(null);

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
        <LiveGeneratedEditingAssetShelf
          projectId={projectId}
          onUseAsset={setSelectedAsset}
        />
        {selectedAsset ? (
          <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="font-medium">Selected for edit</p>
            <p>Job: {selectedAsset.generationJobId}</p>
            <p>Operation: {selectedAsset.operationId ?? '—'}</p>
            <p>URI: {selectedAsset.uri}</p>
            <p>MIME: {selectedAsset.mimeType}</p>
          </div>
        ) : null}
      </section>

      <WorkstationTimeline
        projectId={projectId}
        durationSeconds={30}
        tracks={initialTracks}
      />
    </main>
  );
}
