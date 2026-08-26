'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EditingAssetManifestEntry } from '@jhadina/director-core';
import { GeneratedEditingAssetShelf } from './GeneratedEditingAssetShelf';

export type LiveGeneratedEditingAssetShelfProps = {
  projectId: string;
  refreshMs?: number;
  onUseAsset?: (asset: EditingAssetManifestEntry) => void;
};

export function LiveGeneratedEditingAssetShelf({ projectId, refreshMs = 5000, onUseAsset }: LiveGeneratedEditingAssetShelfProps) {
  const [assets, setAssets] = useState<EditingAssetManifestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/workstation/editing-assets?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      const data = await response.json() as { ok?: boolean; assets?: EditingAssetManifestEntry[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Unable to load generated editing assets');
      setAssets(data.assets ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load generated editing assets');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    if (refreshMs <= 0) return;
    const timer = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(timer);
  }, [load, refreshMs]);

  async function approve(asset: EditingAssetManifestEntry) {
    const response = await fetch('/api/workstation/editing-assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, assetId: asset.assetId }),
    });
    if (!response.ok) return;
    await load();
  }

  return (
    <div className="space-y-2">
      {loading ? <p className="text-xs text-muted-foreground">Loading generated assets…</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <GeneratedEditingAssetShelf
        assets={assets}
        onUseAsset={onUseAsset}
      />
      {assets.some((asset) => asset.status === 'ready') ? (
        <div className="flex flex-wrap gap-2">
          {assets.filter((asset) => asset.status === 'ready').map((asset) => (
            <button key={asset.assetId} type="button" className="rounded border px-3 py-1.5 text-xs" onClick={() => void approve(asset)}>
              Approve {asset.kind} · {asset.assetId.slice(0, 18)}…
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
