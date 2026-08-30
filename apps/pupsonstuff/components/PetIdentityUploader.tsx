"use client";

import { useEffect, useState } from "react";

interface CreativeOutput {
  id: string;
  assetId: string;
  uri: string;
  signedUrl?: string;
}

interface Props {
  productId: string;
  artStyle: string;
  onCompleted: (outputs: CreativeOutput[]) => void;
}

const MAX_PHOTOS = 3;
const POLL_MS = 1500;

export default function PetIdentityUploader({ productId, artStyle, onCompleted }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [petName, setPetName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [backgroundMode, setBackgroundMode] = useState<"auto" | "transparent" | "keep" | "generate">("auto");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const handleFiles = (nextFiles: FileList | null) => {
    if (!nextFiles) return;
    const next = Array.from(nextFiles).slice(0, MAX_PHOTOS);
    setFiles(next);
    setError(null);
    setStatus(null);
  };

  const removeFile = (index: number) => setFiles((current) => current.filter((_, i) => i !== index));

  const submit = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setError(null);
    setStatus("Saving your pet photos…");

    try {
      const form = new FormData();
      files.forEach((file) => form.append("photos", file));
      form.append("petName", petName);
      form.append("productId", productId);
      form.append("artStyle", artStyle);
      form.append("prompt", prompt);
      form.append("backgroundMode", backgroundMode);
      form.append("outputCount", "3");

      const enqueueResponse = await fetch("/api/pet-creative-job", { method: "POST", body: form });
      const enqueue = await enqueueResponse.json();
      if (!enqueueResponse.ok || !enqueue.success) throw new Error(enqueue.error ?? "Could not save the pet identity.");

      const jobId = enqueue.job.id as string;
      setStatus("Your designs are being created…");

      // The enqueue request is intentionally non-blocking. A worker claims the
      // durable job; this client only observes its state.
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const statusResponse = await fetch(`/api/pet-creative-job/${jobId}`, { cache: "no-store" });
        const current = await statusResponse.json();
        if (!statusResponse.ok || !current.success) throw new Error(current.error ?? "Could not read the creative job.");

        if (current.job.status === "completed") {
          setStatus("Your designs are ready.");
          onCompleted(current.outputs ?? []);
          break;
        }
        if (current.job.status === "failed" || current.job.status === "cancelled") {
          throw new Error(current.job.error_message ?? "The creative job could not be completed.");
        }

        setStatus(current.job.status === "preprocessing" ? "Preparing your pet…" : current.job.status === "generating" ? "Creating your designs…" : "Your designs are queued…");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-greige/50 bg-white/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-bronze">Your pet</h3>
          <p className="text-xs text-ink/50">One photo is enough. Add up to 3 for a better likeness.</p>
        </div>
        <span className="text-xs text-ink/40">{files.length}/{MAX_PHOTOS}</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {previews.map((src, index) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-lg border border-greige/40 bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Pet reference ${index + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => removeFile(index)} aria-label={`Remove photo ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-ink/70 px-1.5 text-xs text-cream">×</button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-honey-oak/60 bg-cream/60 text-xl text-bronze transition hover:bg-honey-oak/10">
            +
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => handleFiles(event.target.files)} />
          </label>
        )}
      </div>

      <input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="Pet name (optional)" maxLength={80} className="mb-3 w-full rounded-md border border-greige/50 bg-cream px-3 py-2 text-sm outline-none focus:border-honey-oak" />
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe what you want… or leave it blank." maxLength={2000} rows={3} className="mb-3 w-full resize-none rounded-md border border-greige/50 bg-cream px-3 py-2 text-sm outline-none focus:border-honey-oak" />

      <div className="mb-3">
        <span className="mb-2 block text-xs font-medium text-bronze">Background</span>
        <div className="grid grid-cols-2 gap-2">
          {[['auto', 'Remove by default'], ['transparent', 'Transparent'], ['keep', 'Keep photo'], ['generate', 'Describe one']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setBackgroundMode(value as typeof backgroundMode)} className={`rounded-md border px-2 py-2 text-xs transition ${backgroundMode === value ? "border-honey-oak bg-honey-oak text-cream" : "border-greige/50 text-ink/60 hover:border-honey-oak"}`}>{label}</button>
          ))}
        </div>
      </div>

      {status && <p className="mb-2 text-xs text-bronze">{status}</p>}
      {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <button type="button" onClick={submit} disabled={!files.length || busy} className="w-full rounded-md bg-bronze py-3 text-sm font-semibold text-cream transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Creating…" : "Create 3 designs"}</button>
    </section>
  );
}
