"use client";

import { useEffect, useState } from "react";
import type { CreativeArtProvider, CreativeArtResult } from "@jhadina/director-core";
import type { ModelRecord } from "@jhadina/director-core";

type Props = {
  provider: CreativeArtProvider;
  model: ModelRecord;
  projectId: string;
  onGenerated?: (result: CreativeArtResult) => void;
};

export function AiPodCreationScreen({ provider, model, projectId, onGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [generation, setGeneration] = useState<CreativeArtResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!generation || ["completed", "failed", "cancelled"].includes(generation.status)) return;

    const timer = window.setInterval(async () => {
      try {
        const updated = await provider.refreshGenerationStatus(generation.generationId);
        setGeneration(updated);
        if (updated.status === "completed") onGenerated?.(updated);
        if (["completed", "failed", "cancelled"].includes(updated.status)) {
          window.clearInterval(timer);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        window.clearInterval(timer);
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [generation, onGenerated, provider]);

  async function handleGenerate() {
    const value = prompt.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await provider.generate({
        requestId: `ai-pod:${crypto.randomUUID()}`,
        projectId,
        prompt: value,
        model,
        parameters: { source: "ai-pod-store" },
        modality: "image",
      });
      setGeneration(result);
      if (result.status === "completed") onGenerated?.(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="AI product creation" className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-60">AI POD Studio</p>
        <h1 className="text-4xl font-semibold tracking-tight">Create artwork for anything.</h1>
        <p className="max-w-2xl text-base opacity-70">
          Describe the design you want. The shared creative engine generates the artwork,
          then the product studio can place it on merchandise.
        </p>
      </div>

      <div className="rounded-3xl border p-5 shadow-sm">
        <label htmlFor="creative-prompt" className="mb-2 block text-sm font-medium">
          What should we create?
        </label>
        <textarea
          id="creative-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="A bold retro desert racing graphic with a hand-painted feel..."
          rows={5}
          className="w-full resize-none rounded-2xl border bg-transparent p-4 outline-none"
          disabled={busy}
        />
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-sm opacity-60">
            {generation ? `${generation.status}${generation.assetIds.length ? ` · ${generation.assetIds.length} asset(s)` : ""}` : "Ready to create"}
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || !prompt.trim()}
            className="rounded-full px-6 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Creating…" : "Generate artwork"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
