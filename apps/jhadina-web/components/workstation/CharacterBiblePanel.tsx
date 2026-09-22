'use client';

import { useState } from 'react';

type Props = { projectId: string };

type ReferenceState = {
  id: string;
  name: string;
  status: 'uploading' | 'quarantined' | 'admitted' | 'rejected' | 'error';
  error?: string;
};

const lines = (value: string) =>
  [...new Set(value.split(/\r?\n|,/g).map((item) => item.trim()).filter(Boolean))];

export function CharacterBiblePanel({ projectId }: Props) {
  const [characterId, setCharacterId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [archetype, setArchetype] = useState<'human' | 'cartoon' | 'puppet' | 'creature'>('human');
  const [characterDescription, setCharacterDescription] = useState('');
  const [appearanceDescription, setAppearanceDescription] = useState('');
  const [performanceNotes, setPerformanceNotes] = useState('');
  const [lockedTraits, setLockedTraits] = useState('');
  const [rightsRef, setRightsRef] = useState('rights:owned-or-licensed');
  const [references, setReferences] = useState<ReferenceState[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadReferenceFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    setMessage(null);

    const next: ReferenceState[] = [...references];
    try {
      for (const file of Array.from(files)) {
        const localKey = `local:${crypto.randomUUID()}`;
        next.push({ id: localKey, name: file.name, status: 'uploading' });
        setReferences([...next]);

        const form = new FormData();
        form.set('file', file);
        form.set('projectId', projectId);
        form.set('rightsRef', rightsRef.trim() || 'rights:unspecified');
        form.set('viewHint', 'unknown');

        const upload = await fetch('/api/director/characters/references', { method: 'POST', body: form });
        const uploadData = await upload.json() as {
          ok?: boolean;
          error?: string;
          asset?: { id?: string; admission_status?: string; scan_status?: string };
        };
        if (!upload.ok || !uploadData.ok || !uploadData.asset?.id) {
          const index = next.findIndex((item) => item.id === localKey);
          if (index >= 0) next[index] = { ...next[index]!, status: 'error', error: uploadData.error ?? 'Reference upload failed' };
          setReferences([...next]);
          continue;
        }

        const assetId = uploadData.asset.id;
        const index = next.findIndex((item) => item.id === localKey);
        next[index] = {
          id: assetId,
          name: file.name,
          status: uploadData.asset.admission_status === 'admitted' && uploadData.asset.scan_status === 'clean'
            ? 'admitted'
            : 'quarantined',
        };
        setReferences([...next]);

        if (next[index]?.status === 'admitted') continue;

        const admit = await fetch(`/api/director/characters/references/${encodeURIComponent(assetId)}/admit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        const admitData = await admit.json() as { ok?: boolean; error?: string; admissionStatus?: string };
        next[index] = {
          id: assetId,
          name: file.name,
          status: admit.ok && admitData.ok ? 'admitted' : admitData.admissionStatus === 'rejected' ? 'rejected' : 'error',
          ...(!admit.ok || !admitData.ok ? { error: admitData.error ?? 'Reference admission failed' } : {}),
        };
        setReferences([...next]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function createCharacter() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const referenceAssetIds = references.filter((item) => item.status === 'admitted').map((item) => item.id);
      if (!characterId.trim() || !displayName.trim()) throw new Error('Character ID and display name are required.');
      if (!referenceAssetIds.length) throw new Error('Upload and admit at least one character reference sheet/image first.');

      const response = await fetch('/api/director/characters/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          characterId: characterId.trim(),
          displayName: displayName.trim(),
          archetype,
          referenceAssetIds,
          characterDescription,
          appearanceDescription,
          performanceNotes: lines(performanceNotes),
          lockedTraits: lines(lockedTraits),
          commercialUse: true,
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; descriptionRevision?: number };
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Unable to create Cast Bible character.');
      setMessage(`Character Bible created. Description revision ${data.descriptionRevision ?? 1}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create character.');
    } finally {
      setBusy(false);
    }
  }

  async function loadDescriptions() {
    if (busy || !characterId.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/director/characters/${encodeURIComponent(characterId.trim())}/description?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' },
      );
      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        character?: {
          displayName?: string;
          characterDescription?: string | null;
          appearanceDescription?: string | null;
          performanceNotes?: string[];
          descriptionRevision?: number;
        };
      };
      if (!response.ok || !data.ok || !data.character) throw new Error(data.error ?? 'Character not found.');
      setDisplayName(data.character.displayName ?? displayName);
      setCharacterDescription(data.character.characterDescription ?? '');
      setAppearanceDescription(data.character.appearanceDescription ?? '');
      setPerformanceNotes((data.character.performanceNotes ?? []).join('\n'));
      setMessage(`Loaded description revision ${data.character.descriptionRevision ?? 1}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load character.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDescriptions() {
    if (busy || !characterId.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/director/characters/${encodeURIComponent(characterId.trim())}/description`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId,
            characterDescription,
            appearanceDescription,
            performanceNotes: lines(performanceNotes),
          }),
        },
      );
      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        character?: { descriptionRevision?: number };
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Unable to save descriptions.');
      setMessage(`Descriptions saved as revision ${data.character?.descriptionRevision ?? 'new'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save descriptions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Director Cast Bible</p>
        <h2 className="text-lg font-semibold">Character reference + written description</h2>
        <p className="text-xs text-muted-foreground">
          Reference images define visual identity. Written descriptions add personality, appearance details, mannerisms, and performance direction without overriding the approved reference sheet.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium">Character ID</span>
          <input className="w-full rounded border bg-background px-3 py-2" value={characterId} onChange={(event) => setCharacterId(event.target.value)} placeholder="maya" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium">Display name</span>
          <input className="w-full rounded border bg-background px-3 py-2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Maya" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium">Archetype</span>
          <select className="w-full rounded border bg-background px-3 py-2" value={archetype} onChange={(event) => setArchetype(event.target.value as typeof archetype)}>
            <option value="human">Human</option>
            <option value="cartoon">Cartoon</option>
            <option value="puppet">Puppet / Muppet-style</option>
            <option value="creature">Creature</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium">Reference rights</span>
          <input className="w-full rounded border bg-background px-3 py-2" value={rightsRef} onChange={(event) => setRightsRef(event.target.value)} placeholder="rights:owned" />
        </label>
      </div>

      <label className="mt-3 block text-xs">
        <span className="mb-1 block font-medium">Character description</span>
        <textarea className="min-h-24 w-full rounded border bg-background px-3 py-2" value={characterDescription} onChange={(event) => setCharacterDescription(event.target.value)} placeholder="Who they are, temperament, personality, role, energy, habits…" />
      </label>

      <label className="mt-3 block text-xs">
        <span className="mb-1 block font-medium">Appearance description</span>
        <textarea className="min-h-24 w-full rounded border bg-background px-3 py-2" value={appearanceDescription} onChange={(event) => setAppearanceDescription(event.target.value)} placeholder="Build, face, hair, age range, distinguishing features, normal wardrobe…" />
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium">Performance / mannerism notes</span>
          <textarea className="min-h-28 w-full rounded border bg-background px-3 py-2" value={performanceNotes} onChange={(event) => setPerformanceNotes(event.target.value)} placeholder={"Measured movement\nDry delivery\nAvoids eye contact when vulnerable"} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium">Locked identity traits</span>
          <textarea className="min-h-28 w-full rounded border bg-background px-3 py-2" value={lockedTraits} onChange={(event) => setLockedTraits(event.target.value)} placeholder={"Scar above left eyebrow\nBrown eyes\nTall, broad shoulders"} />
        </label>
      </div>

      <div className="mt-4 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded border px-3 py-2 text-xs font-medium">
            {busy ? 'Working…' : 'Add reference sheet / images'}
            <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => void uploadReferenceFiles(event.target.files)} />
          </label>
          <span className="text-xs text-muted-foreground">One reference sheet is enough to start; extra angles can be added when useful.</span>
        </div>
        {references.length ? (
          <div className="mt-3 grid gap-2">
            {references.map((reference) => (
              <div key={reference.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs">
                <span className="truncate">{reference.name}</span>
                <span className={reference.status === 'admitted' ? 'font-medium' : 'text-muted-foreground'}>
                  {reference.status}{reference.error ? `: ${reference.error}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void createCharacter()}>
          Create character from sheet + description
        </button>
        <button className="rounded border px-3 py-2 text-xs disabled:opacity-50" disabled={busy || !characterId.trim()} onClick={() => void loadDescriptions()}>
          Load existing description
        </button>
        <button className="rounded border px-3 py-2 text-xs disabled:opacity-50" disabled={busy || !characterId.trim()} onClick={() => void saveDescriptions()}>
          Save description revision
        </button>
      </div>

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
