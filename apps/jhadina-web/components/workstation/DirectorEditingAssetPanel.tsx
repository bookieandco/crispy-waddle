'use client';

import type { EditingAssetManifestEntry } from '@jhadina/director-core/editing-asset-manifest';

export type DirectorEditingAssetPanelProps = {
  assets: EditingAssetManifestEntry[];
  onUseAsset?: (asset: EditingAssetManifestEntry) => void;
};

function statusLabel(status: EditingAssetManifestEntry['status']): string {
  return status === 'approved' ? 'Approved' : status === 'ready' ? 'Ready for approval' : status[0].toUpperCase() + status.slice(1);
}

export function DirectorEditingAssetPanel({ assets, onUseAsset }: DirectorEditingAssetPanelProps) {
  return (
    <section aria-label="Generated editing assets" className="rounded-xl border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Generated Editing Assets</h2>
          <p className="text-xs text-muted-foreground">Approved outputs available to the DirectorOS edit surface.</p>
        </div>
        <span className="text-xs text-muted-foreground">{assets.length} asset{assets.length === 1 ? '' : 's'}</span>
      </div>

      <div className="divide-y">
        {assets.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No generated editing assets are available for this project.</div>
        ) : assets.map((asset) => (
          <article key={asset.assetId} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{asset.kind}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${asset.status === 'approved' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                  {statusLabel(asset.status)}
                </span>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs md:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Generation job: </dt><dd className="inline font-mono">{asset.generationJobId}</dd></div>
                <div><dt className="inline text-muted-foreground">MIME: </dt><dd className="inline font-mono">{asset.mimeType ?? 'unknown'}</dd></div>
                {asset.operationId ? <div><dt className="inline text-muted-foreground">Operation: </dt><dd className="inline font-mono">{asset.operationId}</dd></div> : null}
                {asset.sourceId ? <div><dt className="inline text-muted-foreground">Source: </dt><dd className="inline font-mono">{asset.sourceId}</dd></div> : null}
              </dl>
              <div className="mt-2 truncate rounded bg-muted/50 px-2 py-1 font-mono text-[10px]" title={asset.uri}>{asset.uri}</div>
            </div>
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!asset.usable || asset.status !== 'approved' || !onUseAsset}
              onClick={() => onUseAsset?.(asset)}
            >
              Use in edit
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
