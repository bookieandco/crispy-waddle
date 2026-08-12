'use client';

import { useState } from 'react';

export type StudioCommand =
  | { type: 'ask'; prompt: string }
  | { type: 'import'; files: File[] }
  | { type: 'select'; target: 'character' | 'audio' | 'camera' | 'effect' }
  | { type: 'advanced'; open: boolean };

interface StudioCommandBarProps {
  onCommand?: (command: StudioCommand) => void;
}

export function StudioCommandBar({ onCommand }: StudioCommandBarProps) {
  const [prompt, setPrompt] = useState('');
  const [advanced, setAdvanced] = useState(false);

  const submit = () => {
    const value = prompt.trim();
    if (!value) return;
    onCommand?.({ type: 'ask', prompt: value });
    setPrompt('');
  };

  return (
    <div role="toolbar" aria-label="Studio controls" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onCommand?.({ type: 'select', target: 'character' })}>Select character</button>
        <button type="button" onClick={() => onCommand?.({ type: 'select', target: 'audio' })}>Select audio</button>
        <button type="button" onClick={() => onCommand?.({ type: 'select', target: 'effect' })}>Add effect</button>
        <label style={{ cursor: 'pointer' }}>
          <span>Import media</span>
          <input hidden type="file" multiple accept="video/*,audio/*,image/*,.glb,.gltf" onChange={(event) => onCommand?.({ type: 'import', files: Array.from(event.target.files ?? []) })} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          placeholder="Ask Jhadina: “sync this character to my audio”"
          aria-label="Ask Jhadina"
          style={{ flex: 1, minWidth: 180 }}
        />
        <button type="button" onClick={submit}>Ask</button>
      </div>
      <button type="button" aria-expanded={advanced} onClick={() => { const next = !advanced; setAdvanced(next); onCommand?.({ type: 'advanced', open: next }); }}>
        {advanced ? 'Hide advanced controls' : 'Show advanced controls'}
      </button>
    </div>
  );
}
