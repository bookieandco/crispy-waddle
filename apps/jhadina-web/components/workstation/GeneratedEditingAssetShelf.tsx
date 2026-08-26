'use client';

import type { EditingAssetManifestEntry } from '@jhadina/director-core';

export type GeneratedEditingAssetShelfProps = {
  assets: EditingAssetManifestEntry[];
  onUseAsset?: (asset: EditingAssetManifestEntry) => void;
};

export function GeneratedEditingAssetShelf({ assets, onUseAsset }: GeneratedEditingAssetShelfProps) {
  const usable = assets.filter((asset) => asset.usable);

  return (
    <section className="rounded-lg border p-3" aria-label="Generated editing assets">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Generated Editing Assets</h3>
          <p className="text-xs text-muted-foreground">Live project assets • explicit approval required before use.</p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs">{usable.length} approved</span>
      </div>

      <div className="mt-3 space-y-2">
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No generated assets yet.</p>
        ) : assets.map((asset) => (
          <div key={asset.assetId} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{asset.kind}</span>
                <span className={asset.usable ? 'text-emerald-600' : 'text-muted-foreground'}>{asset.status}</span>
              </div>
              <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground md:grid-cols-2">
                <div><dt className="inline">Asset: </dt><dd className="inline font-mono">{asset.assetId}</dd></div>
                <div><dt className="inline">Job: </dt><dd className="inline font-mono">{asset.generationJobId}</dd></div>
                <div><dt className="inline">MIME: </dt><dd className="inline font-mono">{asset.mimeType ?? 'unknown'}</dd></div>
                {asset.operationId ? <div><dt className="inline">Operation: </dt><dd className="inline font-mono">{asset.operationId}</dd></div> : null}
                {asset.sourceId ? <div><dt className="inline">Source: </dt><dd className="inline font-mono">{asset.sourceId}</dd></div> : null}
              </dl>
              {asset.startSeconds !== undefined && asset.endSeconds !== undefined ? (
                <p className="mt-1 text-[10px] text-muted-foreground">{asset.startSeconds.toFixed(1)}s → {asset.endSeconds.toFixed(1)}s</p>
              ) : null}
              <p className="mt-1 truncate rounded bg-muted/50 px-2 py-1 font-mono text-[10px]" title={asset.uri}>{asset.uri}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded border px-3 py-1.5 text-xs disabled:opacity-40"
              disabled={!asset.usable}
              onClick={() => onUseAsset?.(asset)}
            >
              Use in edit
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}