'use client';

import { useMemo, useState } from 'react';
import { createCompleteJhadinaExport, type CreatorProject } from '@jhadina/integration';

const initialProject: CreatorProject = {
  id: 'workstation-demo',
  name: 'Untitled Creator Project',
  domain: 'directoros',
  version: 1,
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: {},
  assets: [],
  scenes: [
    { id: 'scene-1', title: 'Scene 01', order: 1, summary: 'Opening beat', takeIds: [] },
  ],
};

export function CreatorWorkstation() {
  const [project, setProject] = useState<CreatorProject>(initialProject);
  const [selectedSceneId, setSelectedSceneId] = useState(project.scenes[0]?.id ?? '');
  const selectedScene = project.scenes.find((scene) => scene.id === selectedSceneId);
  const exportPackage = useMemo(() => createCompleteJhadinaExport(project), [project]);

  function addScene() {
    const scene = { id: `scene-${project.scenes.length + 1}`, title: `Scene ${String(project.scenes.length + 1).padStart(2, '0')}`, order: project.scenes.length + 1, summary: '', takeIds: [] };
    setProject((current) => ({ ...current, version: current.version + 1, updatedAt: new Date().toISOString(), scenes: [...current.scenes, scene] }));
    setSelectedSceneId(scene.id);
  }

  function downloadJhadina() {
    const blob = new Blob([JSON.stringify(exportPackage.document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportPackage.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#0d0d10', color: '#f5f5f7' }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div><div style={{ fontSize: 12, opacity: .5, letterSpacing: '.16em', textTransform: 'uppercase' }}>Creator Workstation</div><h1 style={{ margin: '6px 0 0' }}>{project.name}</h1></div>
        <button type="button" onClick={downloadJhadina} style={buttonStyle}>Export .jhadina</button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 320px', gap: 16 }}>
        <aside style={panelStyle}>
          <div style={labelStyle}>Project graph</div>
          <button type="button" onClick={addScene} style={{ ...buttonStyle, width: '100%', marginBottom: 14 }}>+ Add scene</button>
          {project.scenes.map((scene) => <button key={scene.id} type="button" onClick={() => setSelectedSceneId(scene.id)} style={{ ...rowButtonStyle, opacity: scene.id === selectedSceneId ? 1 : .6 }}>{scene.order}. {scene.title}<span>{scene.takeIds.length} takes</span></button>)}
        </aside>

        <section style={panelStyle}>
          <div style={labelStyle}>Timeline / takes</div>
          {selectedScene ? <>
            <h2 style={{ marginTop: 4 }}>{selectedScene.title}</h2>
            <p style={{ opacity: .55 }}>{selectedScene.summary || 'No scene summary yet.'}</p>
            <div style={{ minHeight: 280, border: '1px dashed rgba(255,255,255,.14)', borderRadius: 18, display: 'grid', placeItems: 'center', opacity: .55 }}>
              {selectedScene.takeIds.length ? `${selectedScene.takeIds.length} candidate takes` : 'DirectorOS takes will appear here'}
            </div>
          </> : <p>Select a scene.</p>}
        </section>

        <aside style={panelStyle}>
          <div style={labelStyle}>Project / export</div>
          <dl style={{ lineHeight: 1.8 }}>
            <div><dt style={labelStyle}>Status</dt><dd style={{ margin: 0 }}>{project.status}</dd></div>
            <div><dt style={labelStyle}>Version</dt><dd style={{ margin: 0 }}>{project.version}</dd></div>
            <div><dt style={labelStyle}>Scenes</dt><dd style={{ margin: 0 }}>{project.scenes.length}</dd></div>
            <div><dt style={labelStyle}>Assets</dt><dd style={{ margin: 0 }}>{project.assets.length}</dd></div>
          </dl>
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.08)' }}>
            <div style={labelStyle}>Portable package</div>
            <p style={{ opacity: .65, fontSize: 13 }}>The export preserves project IDs, versions, scenes, takes and asset references so Jhadina can reopen the graph and continue production.</p>
            <button type="button" onClick={downloadJhadina} style={{ ...buttonStyle, width: '100%' }}>Save complete document</button>
          </div>
        </aside>
      </section>
    </main>
  );
}

const panelStyle = { background: '#151519', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 18 } as const;
const labelStyle = { fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.14em', opacity: .45 } as const;
const buttonStyle = { border: '1px solid rgba(255,255,255,.12)', background: '#222229', color: 'inherit', borderRadius: 12, padding: '10px 14px', cursor: 'pointer' } as const;
const rowButtonStyle = { display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left' as const, border: 0, background: 'transparent', color: 'inherit', padding: '11px 8px', borderRadius: 10, cursor: 'pointer' } as const;
