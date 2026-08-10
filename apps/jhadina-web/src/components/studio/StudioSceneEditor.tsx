'use client';
import { useMemo, useState } from 'react';
import styles from './StudioSceneEditor.module.css';

const layers = ['Video', 'Character', 'Rig', 'Effects', 'Audio', 'QC'];
const issues = [
  { label: 'Lighting mismatch', range: '418–463', severity: 'warning' },
  { label: 'Lip sync', range: '612–628', severity: 'info' },
];

export function StudioSceneEditor() {
  const [frame, setFrame] = useState(418);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const currentIssue = issues[selected];
  const progress = useMemo(() => Math.min(100, Math.max(0, (frame / 720) * 100)), [frame]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Jhadina · Studio</span><h1>Scene Editor</h1><p>Build the scene. Jhadina handles the complicated parts.</p></div>
      <div className={styles.actions}><button type="button" className={styles.secondary}>Undo</button><button type="button" className={styles.primary}>✦ Ask Jhadina</button></div>
    </header>

    <section className={styles.editor}>
      <div className={styles.preview}>
        <div className={styles.previewTop}><span>SCENE 01</span><span>24 FPS · 00:30</span></div>
        <div className={styles.stage}><div className={styles.subject}>PREVIEW</div><span className={styles.safe}>Safe area</span></div>
        <div className={styles.transport}><button type="button" onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button><span>00:{String(Math.floor(frame / 24)).padStart(2, '0')}</span><input aria-label="Timeline position" type="range" min="0" max="720" value={frame} onChange={(e) => setFrame(Number(e.target.value))}/><span>00:30</span></div>
      </div>

      <aside className={styles.inspector}>
        <div className={styles.inspectorHeader}><b>Jhadina QC</b><span className={styles.score}>90</span></div>
        <p className={styles.good}>✓ Good to review</p>
        <div className={styles.issueList}>{issues.map((issue, i) => <button type="button" key={issue.label} className={i === selected ? styles.issueActive : styles.issue} onClick={() => { setSelected(i); setFrame(Number(issue.range.split('–')[0])); }}><span>{issue.severity === 'warning' ? '⚠' : '●'} {issue.label}</span><small>Frames {issue.range}</small></button>)}</div>
        <div className={styles.fix}><b>{currentIssue.label}</b><p>Jhadina can isolate this section and prepare a correction without rebuilding the whole scene.</p><button type="button" className={styles.primary}>Preview fix</button></div>
      </aside>

      <div className={styles.timeline}><div className={styles.timelineHead}><b>Timeline</b><span>Frame {frame} / 720</span></div>{layers.map((layer, i) => <div className={styles.track} key={layer}><span>{layer}</span><div className={styles.trackBar}>{i === 5 && <div className={styles.marker} style={{ left: `${(418 / 720) * 100}%` }}/>}</div></div>)}<div className={styles.playhead} style={{ left: `calc(88px + ${progress}% * (100% - 88px) / 100)` }}/></div>
    </section>
  </main>;
}
