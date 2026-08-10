'use client';

import { useMemo, useState } from 'react';
import { createCompleteJhadinaExport, type CreatorProject } from '@jhadina/integration';

const initialProject: CreatorProject = {
  id: 'workstation-demo', name: 'Untitled Creator Project', domain: 'directoros', version: 1, status: 'draft',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), metadata: {}, assets: [],
  scenes: [{ id: 'scene-1', title: 'Scene 01', order: 1, summary: 'Opening beat', takeIds: [] }],
};

type TakeCard = { takeId: string; clipUri?: string; provider?: string; instruction: string; status: 'candidate' | 'selected' };

export function CreatorWorkstation() {
  const [project, setProject] = useState<CreatorProject>(initialProject);
  const [selectedSceneId, setSelectedSceneId] = useState(project.scenes[0]?.id ?? '');
  const [instruction, setInstruction] = useState('');
  const [takes, setTakes] = useState<Record<string, TakeCard[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selectedScene = project.scenes.find((scene) => scene.id === selectedSceneId);
  const exportPackage = useMemo(() => createCompleteJhadinaExport(project), [project]);
  const sceneTakes = selectedScene ? (takes[selectedScene.id] ?? []) : [];

  function addScene() {
    const scene = { id: `scene-${project.scenes.length + 1}`, title: `Scene ${String(project.scenes.length + 1).padStart(2, '0')}`, order: project.scenes.length + 1, summary: '', takeIds: [] };
    setProject((current) => ({ ...current, version: current.version + 1, updatedAt: new Date().toISOString(), scenes: [...current.scenes, scene] }));
    setSelectedSceneId(scene.id);
  }

  async function generateTake(regenerate = false) {
    if (!selectedScene) return;
    setBusy(true); setMessage('Sending through Jhadina Policy → Action Executor → DirectorOS…');
    const previous = sceneTakes.at(-1);
    try {
      const response = await fetch('/api/workstation/takes', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, capability: regenerate ? 'take.regenerate' : 'take.generate', input: {
          projectId: project.id,
          shot: { id: selectedScene.id, projectId: project.id, sceneScriptOrder: selectedScene.order, ordinal: 1, shotType: 'medium', durationSec: 8, action: selectedScene.summary || selectedScene.title, entityHandles: [], status: 'approved', director: { lens: '35mm', cameraMovement: 'slow dolly', lightingMood: 'cinematic', lookPreset: 'cinematic' } },
          instruction,
          priorTake: previous ? { takeId: previous.takeId, clipUri: previous.clipUri ?? '', provider: previous.provider ?? '', notes: 'Previous candidate take selected for continuity.' } : undefined,
        } }),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error?.message ?? 'DirectorOS action failed.');
      const output = result.output as { takeId: string; clipUri: string; provider: string };
      setTakes((current) => ({ ...current, [selectedScene.id]: [...(current[selectedScene.id] ?? []), { takeId: output.takeId, clipUri: output.clipUri, provider: output.provider, instruction, status: 'candidate' }] }));
      setProject((current) => ({ ...current, version: current.version + 1, updatedAt: new Date().toISOString(), scenes: current.scenes.map((scene) => scene.id === selectedScene.id ? { ...scene, takeIds: [...scene.takeIds, output.takeId] } : scene) }));
      setInstruction(''); setMessage(`Take ${output.takeId.slice(0, 8)} created.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Generation failed.'); }
    finally { setBusy(false); }
  }

  function selectTake(takeId: string) {
    if (!selectedScene) return;
    setTakes((current) => ({ ...current, [selectedScene.id]: (current[selectedScene.id] ?? []).map((take) => ({ ...take, status: take.takeId === takeId ? 'selected' : 'candidate' })) }));
  }

  function downloadJhadina() {
    const blob = new Blob([JSON.stringify(exportPackage.document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = exportPackage.filename; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#0d0d10', color: '#f5f5f7' }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div><div style={labelStyle}>Creator Workstation</div><h1 style={{ margin: '6px 0 0' }}>{project.name}</h1></div>
        <button type="button" onClick={downloadJhadina} style={buttonStyle}>Export .jhadina</button>
      </header>
      <section style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 320px', gap: 16 }}>
        <aside style={panelStyle}><div style={labelStyle}>Project graph</div><button type="button" onClick={addScene} style={{ ...buttonStyle, width: '100%', marginBottom: 14 }}>+ Add scene</button>
          {project.scenes.map((scene) => <button key={scene.id} type="button" onClick={() => setSelectedSceneId(scene.id)} style={{ ...rowButtonStyle, opacity: scene.id === selectedSceneId ? 1 : .6 }}>{scene.order}. {scene.title}<span>{scene.takeIds.length} takes</span></button>)}
        </aside>
        <section style={panelStyle}><div style={labelStyle}>DirectorOS / Takes</div>{selectedScene ? <>
          <h2 style={{ marginTop: 4 }}>{selectedScene.title}</h2><p style={{ opacity: .55 }}>{selectedScene.summary || 'Describe the scene and direct the next take.'}</p>
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Tell Jhadina what to change: 'same performance, add a slow push-in and have her glance at camera'" style={textareaStyle} />
          <div style={{ display: 'flex', gap: 8, margin: '12px 0 18px' }}><button disabled={busy} onClick={() => generateTake(false)} style={buttonStyle}>{busy ? 'Working…' : 'Generate take'}</button><button disabled={busy || sceneTakes.length === 0} onClick={() => generateTake(true)} style={buttonStyle}>Another take</button></div>
          <div style={{ display: 'grid', gap: 10 }}>{sceneTakes.length === 0 ? <div style={emptyStyle}>No takes yet. Generate the first candidate.</div> : sceneTakes.map((take, index) => <article key={take.takeId} style={{ ...takeStyle, borderColor: take.status === 'selected' ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.08)' }}><div><strong>Take {index + 1}</strong><div style={{ opacity: .5, fontSize: 12 }}>{take.provider} · {take.takeId.slice(0, 8)}</div></div><div style={{ display: 'flex', gap: 8 }}><button onClick={() => selectTake(take.takeId)} style={buttonStyle}>{take.status === 'selected' ? 'Selected' : 'Select'}</button>{take.clipUri && <a href={take.clipUri} target="_blank" rel="noreferrer" style={{ ...buttonStyle, textDecoration: 'none' }}>Preview</a>}</div></article>)}</div>
          {message && <p style={{ fontSize: 13, opacity: .6 }}>{message}</p>}
        </> : <p>Select a scene.</p>}</section>
        <aside style={panelStyle}><div style={labelStyle}>Project / export</div><dl style={{ lineHeight: 1.8 }}><div><dt style={labelStyle}>Status</dt><dd style={{ margin: 0 }}>{project.status}</dd></div><div><dt style={labelStyle}>Version</dt><dd style={{ margin: 0 }}>{project.version}</dd></div><div><dt style={labelStyle}>Scenes</dt><dd style={{ margin: 0 }}>{project.scenes.length}</dd></div><div><dt style={labelStyle}>Assets</dt><dd style={{ margin: 0 }}>{project.assets.length}</dd></div></dl><div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.08)' }}><div style={labelStyle}>Portable package</div><p style={{ opacity: .65, fontSize: 13 }}>The project graph, takes and asset references travel together in the complete Jhadina document.</p><button type="button" onClick={downloadJhadina} style={{ ...buttonStyle, width: '100%' }}>Save complete document</button></div></aside>
      </section>
    </main>
  );
}

const panelStyle = { background: '#151519', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 18 } as const;
const labelStyle = { fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.14em', opacity: .45 } as const;
const buttonStyle = { border: '1px solid rgba(255,255,255,.12)', background: '#222229', color: 'inherit', borderRadius: 12, padding: '10px 14px', cursor: 'pointer' } as const;
const rowButtonStyle = { display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left' as const, border: 0, background: 'transparent', color: 'inherit', padding: '11px 8px', borderRadius: 10, cursor: 'pointer' } as const;
const textareaStyle = { width: '100%', minHeight: 96, boxSizing: 'border-box' as const, background: '#0d0d10', color: 'inherit', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 12, resize: 'vertical' as const } as const;
const emptyStyle = { minHeight: 180, border: '1px dashed rgba(255,255,255,.14)', borderRadius: 18, display: 'grid', placeItems: 'center', opacity: .55 } as const;
const takeStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid', borderRadius: 14, padding: 12 } as const;
