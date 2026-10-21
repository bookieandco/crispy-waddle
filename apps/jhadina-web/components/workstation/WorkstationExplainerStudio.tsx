'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createExplainerPlan,
  directExplainerRevision,
  explainerSrt,
  proposeExplainerSocialDraft,
  type ExplainerPlan,
  type ExplainerScene,
  type ExplainerStyle,
  type ExplainerVoiceDirection,
  type ExplainerPace,
  type ExplainerAspect,
} from '@jhadina/director-core';

const initialScript = 'What happens when an aircraft speed sensor gets blocked? Airspeed is measured from pressure differences. Incorrect indications are dangerous, so flight crews must cross-check instruments and follow the aircraft procedures. An unusual cause may make a memorable story, but any historical claim still needs credible source verification.';
const ratios: ExplainerAspect[] = ['9:16', '16:9', '1:1'];

function localDownload(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sceneAt(plan: ExplainerPlan, second: number): ExplainerScene {
  return plan.scenes.find(scene => second >= scene.startSeconds && second < scene.endSeconds)
    ?? plan.scenes[plan.scenes.length - 1];
}

/** Local motion-graphic proof, not a cinematic generative renderer or a reviewed master. */
function paintFrame(ctx: CanvasRenderingContext2D, plan: ExplainerPlan, second: number) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const scene = sceneAt(plan, second);
  const phase = Math.min(1, Math.max(0, (second - scene.startSeconds) / Math.max(0.1, scene.endSeconds - scene.startSeconds)));
  const minimal = plan.style === 'minimal';
  const dark = plan.style === 'cinematic';
  ctx.fillStyle = dark ? '#101321' : minimal ? '#f3efe7' : '#1c302a';
  ctx.fillRect(0, 0, w, h);
  const ink = dark || !minimal ? '#f7f4ec' : '#202126';
  const accent = dark ? '#b9aaff' : minimal ? '#c18a52' : '#d7a86d';
  const center = w / 2;
  const base = h * 0.42;
  const radius = Math.min(w * 0.21, h * 0.16);
  ctx.save();
  ctx.translate(center, base);
  ctx.rotate(phase * 0.3);
  for (let ring = 0; ring < 3; ring++) {
    ctx.beginPath();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, w * 0.005);
    ctx.globalAlpha = 0.65 - ring * 0.14;
    ctx.arc(0, 0, radius * (0.48 + ring * 0.32 + phase * 0.08), 0, Math.PI * (1 + phase));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(radius * Math.cos(phase * Math.PI * 2), radius * Math.sin(phase * Math.PI * 2), Math.max(8, w * 0.023), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = ink;
  const margin = w * 0.09;
  const font = Math.round(w * 0.057);
  ctx.font = '700 ' + font + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = scene.role === 'hook' ? 'THE QUESTION' : scene.role === 'payoff' ? 'THE TAKEAWAY' : 'HERE IS WHY';
  ctx.fillText(label, center, h * 0.14);
  ctx.font = Math.round(w * 0.034) + 'px system-ui, sans-serif';
  ctx.fillStyle = accent;
  const visual = scene.visualDirection.slice(0, 100);
  drawWrapped(ctx, visual, center, h * 0.66, w - margin * 2, Math.round(w * 0.05), 3);
  if (plan.captions) {
    ctx.fillStyle = ink;
    ctx.font = '600 ' + Math.round(w * 0.038) + 'px system-ui, sans-serif';
    drawWrapped(ctx, scene.narration, center, h * 0.81, w - margin * 2, Math.round(w * 0.05), 4);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(margin, h * 0.952, (w - 2 * margin) * Math.max(0, Math.min(1, second / plan.durationSeconds)), Math.max(3, h * 0.004));
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? current + ' ' + word : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  for (const [index, line] of lines.slice(0, maxLines).entries()) {
    ctx.fillText(index === maxLines - 1 && lines.length > maxLines ? line.slice(0, -3) + '…' : line, x, y + index * lineHeight);
  }
}

export type ExplainerSocialHandoff = { directorProjectId: string; approvedDirectorAssetId: string; suggestedText: string; platform: string };

export function WorkstationExplainerStudio({ projectId, onSocialHandoff }: { projectId: string; onSocialHandoff?: (draft: ExplainerSocialHandoff) => void }) {
  const [title, setTitle] = useState('The Airspeed Mystery');
  const [audience, setAudience] = useState('Curious adults who enjoy educational shorts');
  const [script, setScript] = useState(initialScript);
  const [style, setStyle] = useState<ExplainerStyle>('minimal');
  const [voice, setVoice] = useState<ExplainerVoiceDirection>('documentary');
  const [pace, setPace] = useState<ExplainerPace>('normal');
  const [aspect, setAspect] = useState<ExplainerAspect>('9:16');
  const [duration, setDuration] = useState(30);
  const [sourceRefs, setSourceRefs] = useState('');
  const [rightsRefs, setRightsRefs] = useState('');
  const [plan, setPlan] = useState<ExplainerPlan | null>(null);
  const [direction, setDirection] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [assetId, setAssetId] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [qcRefs, setQcRefs] = useState('');
  const [platform, setPlatform] = useState('youtube-shorts');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playStarted = useRef(0);

  const preview = useCallback((snapshot: ExplainerPlan, second: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) paintFrame(ctx, snapshot, second);
  }, []);

  useEffect(() => { if (plan) preview(plan, time); }, [plan, time, preview]);

  useEffect(() => {
    if (!playing || !plan) return;
    playStarted.current = performance.now() - time * 1000;
    const timer = window.setInterval(() => {
      const now = (performance.now() - playStarted.current) / 1000;
      if (now >= plan.durationSeconds) { setTime(0); setPlaying(false); }
      else setTime(now);
    }, 90);
    return () => window.clearInterval(timer);
    // Deliberately restart the clock only on play/new plan, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, plan]);

  function build() {
    setError('');
    setInfo('');
    setPlaying(false);
    try {
      const next = createExplainerPlan({
        id: crypto.randomUUID(),
        projectId, title, audience, script, style,
        voiceDirection: voice, pace, aspectRatio: aspect,
        captions: true, durationSeconds: duration,
        sourceRefs: sourceRefs.split(',').map(s => s.trim()).filter(Boolean),
        rightsEvidenceRefs: rightsRefs.split(',').map(s => s.trim()).filter(Boolean),
      });
      setPlan(next);
      setTime(0);
      setInfo('Storyboard generated locally. Visuals are placeholder motion graphics, not AI-created scenes or fact-checked footage.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to plan explainer'); }
  }

  function revise() {
    if (!plan) return;
    setError('');
    try {
      const next = directExplainerRevision(plan, direction);
      setPlan(next);
      setTime(0);
      setPlaying(false);
      setDirection('');
      setInfo('Revision ' + next.revision + ' applied locally; no server changes.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Revision failed'); }
  }

  function savePlan() {
    if (!plan) return;
    localDownload('director-explainer-storyboard.json', new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
  }

  function saveCaptions() {
    if (!plan) return;
    localDownload('director-explainer-captions.srt', new Blob([explainerSrt(plan)], { type: 'text/plain;charset=utf-8' }));
  }

  async function renderDraft() {
    if (!plan || rendering) return;
    const canvas = canvasRef.current;
    if (!canvas || !('captureStream' in canvas) || typeof MediaRecorder === 'undefined') {
      setError('Canvas recording is unavailable on this browser. Export the storyboard and SRT instead.');
      return;
    }
    const mime = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
    if (!mime) { setError('No browser-supported video recorder. Try desktop Chrome, then export a draft.'); return; }
    setRendering(true);
    setError('');
    setPlaying(false);
    setInfo('Recording a silent local motion-graphic draft. It is not an approved Director master.');
    let raf = 0;
    let stream: MediaStream | undefined;
    try {
      stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
      const chunks: Blob[] = [];
      let firstError = '';
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { firstError = 'Browser recorder failed'; };
      recorder.onstop = () => {
        window.cancelAnimationFrame(raf);
        stream?.getTracks().forEach(track => track.stop());
        if (chunks.length && !firstError) localDownload('director-explainer-SILENT-DRAFT.' + (mime.startsWith('video/mp4') ? 'mp4' : 'webm'), new Blob(chunks, { type: mime }));
        else setError(firstError || 'Recorder produced no video.');
        setRendering(false);
      };
      paintFrame(canvas.getContext('2d')!, plan, 0);
      recorder.start(1000);
      const started = performance.now();
      const tick = (now: number) => {
        const seconds = Math.max(0, Math.min(plan.durationSeconds, (now - started) / 1000));
        paintFrame(canvas.getContext('2d')!, plan, seconds);
        if (seconds >= plan.durationSeconds) { if (recorder.state !== 'inactive') recorder.stop(); return; }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    } catch {
      window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach(track => track.stop());
      setRendering(false);
      setError('This browser could not record the canvas. Export the storyboard/SRT for the canonical render pipeline.');
    }
  }

  function prepareSocialHandoff() {
    if (!plan) return;
    setError('');
    try {
      const draft = proposeExplainerSocialDraft(plan, {
        approvedDirectorAssetId: assetId,
        assetApprovalReceiptId: approvalId,
        finalQcEvidenceRefs: qcRefs.split(',').map(s => s.trim()).filter(Boolean),
        targetPlatform: platform,
      });
      localDownload('director-social-PENDING-approval.json', new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
      onSocialHandoff?.({ directorProjectId: draft.directorProjectId, approvedDirectorAssetId: draft.approvedDirectorAssetId, suggestedText: draft.suggestedText, platform: draft.platform });
      document.getElementById('director-social-scheduler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setInfo('Guarded handoff package exported locally. Publication is NOT requested. Use the existing Social Scheduler after canonical asset/QC review.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Social draft blocked'); }
  }

  return (
    <section id="explainer-studio" className="rounded-xl border bg-background p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Director Studio / Explainer quick start</p>
        <h2 className="text-xl font-semibold">Narration → storyboard → animated draft</h2>
        <p className="text-sm text-muted-foreground">Owner-controlled planning, simple motion preview and silent local draft recording. Does not generate cinematic footage, voices, fact verification, or publish posts.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Title<input className="mt-1 w-full rounded border bg-background p-2" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="text-sm">Audience<input className="mt-1 w-full rounded border bg-background p-2" value={audience} onChange={e => setAudience(e.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Script / researched narration
          <textarea className="mt-1 min-h-32 w-full rounded border bg-background p-2" value={script} onChange={e => setScript(e.target.value)} maxLength={12000} />
        </label>
        <label className="text-sm">Source reference IDs (comma separated)<input className="mt-1 w-full rounded border bg-background p-2" value={sourceRefs} onChange={e => setSourceRefs(e.target.value)} placeholder="research:source-1" /></label>
        <label className="text-sm">Rights evidence IDs (required for supplied sources)<input className="mt-1 w-full rounded border bg-background p-2" value={rightsRefs} onChange={e => setRightsRefs(e.target.value)} placeholder="rights:source-1" /></label>
        <label className="text-sm">Visual style<select className="mt-1 w-full rounded border bg-background p-2" value={style} onChange={e => setStyle(e.target.value as ExplainerStyle)}><option value="minimal">Minimal</option><option value="chalkboard">Chalkboard</option><option value="cinematic">Cinematic concept</option></select></label>
        <label className="text-sm">Narration direction (not synthesized voice)<select className="mt-1 w-full rounded border bg-background p-2" value={voice} onChange={e => setVoice(e.target.value as ExplainerVoiceDirection)}><option value="documentary">Documentary</option><option value="warm">Warm</option><option value="energetic">Energetic</option></select></label>
        <label className="text-sm">Pacing<select className="mt-1 w-full rounded border bg-background p-2" value={pace} onChange={e => setPace(e.target.value as ExplainerPace)}><option>normal</option><option>relaxed</option><option>fast</option></select></label>
        <label className="text-sm">Format<select className="mt-1 w-full rounded border bg-background p-2" value={aspect} onChange={e => setAspect(e.target.value as ExplainerAspect)}>{ratios.map(ratio => <option key={ratio}>{ratio}</option>)}</select></label>
        <label className="text-sm">Runtime (10–300 seconds)<input type="number" min={10} max={300} className="mt-1 w-full rounded border bg-background p-2" value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
      </div>
      <button type="button" onClick={build} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Direct my explainer (local storyboard)</button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {info ? <p role="status" className="text-sm text-muted-foreground">{info}</p> : null}
      {plan ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
            <div className="space-y-2">
              <div className="mx-auto max-w-[340px]">
                <canvas ref={canvasRef} width={plan.aspectRatio === '9:16' ? 540 : 960} height={plan.aspectRatio === '9:16' ? 960 : plan.aspectRatio === '1:1' ? 960 : 540} className="w-full rounded-xl border bg-muted" aria-label="Animated text and geometric graphics scene preview" />
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded border px-3 py-1 text-sm" type="button" disabled={rendering} onClick={() => { setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button>
                <input className="min-w-0 flex-1" aria-label="Preview time" type="range" min={0} max={plan.durationSeconds} step={0.1} value={Math.min(time, plan.durationSeconds)} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} />
                <span className="text-xs tabular-nums">{Math.floor(time)}s</span>
              </div>
              <p className="text-xs text-muted-foreground">Prototype visuals only. On some iPhones canvas recording is unsupported; interactive preview and JSON/SRT export remain available.</p>
              <div className="flex flex-wrap gap-2">
                <button className="rounded border px-3 py-2 text-xs" onClick={savePlan} type="button">Export storyboard JSON</button>
                <button className="rounded border px-3 py-2 text-xs" onClick={saveCaptions} type="button">Export SRT</button>
                <button className="rounded border px-3 py-2 text-xs" onClick={() => void renderDraft()} disabled={rendering} type="button">{rendering ? 'Recording draft…' : 'Render silent motion draft'}</button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Storyboard · revision {plan.revision} · {plan.scenes.length} scenes</p>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {plan.scenes.map(scene => (
                  <button key={scene.id} type="button" onClick={() => { setPlaying(false); setTime(scene.startSeconds); }} className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/30">
                    <span className="font-semibold">{scene.index}. {scene.role} · {scene.startSeconds.toFixed(1)}–{scene.endSeconds.toFixed(1)}s</span>
                    <span className="mt-1 block">{scene.narration}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{scene.visualDirection}</span>
                    <span className="mt-1 block text-xs font-semibold">Source review required</span>
                  </button>
                ))}
              </div>
              <label className="block text-sm">Revise with a supported direction
                <textarea value={direction} onChange={e => setDirection(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" rows={2} placeholder="scene 2 visual: Diagram the pressure sensor" />
              </label>
              <p className="text-xs text-muted-foreground">Commands: scene 2 narration: … | scene 2 visual: … | style minimal | voice warm | pace fast | format 9:16 | duration 45 | captions off | audience: …</p>
              <button className="rounded border px-3 py-2 text-sm" type="button" onClick={revise}>Apply revision</button>
            </div>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <h3 className="font-semibold text-sm">Social Core handoff · approval-gated</h3>
            <p className="text-xs text-muted-foreground">A browser-rendered silent draft cannot be posted as a master. After Director generates, reviews and approves the real asset, enter its ID, approval receipt and final QC evidence. This exports a pending handoff for the canonical Social workflow; it never posts or spends.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Approved Director asset ID" placeholder="Approved Director asset ID" className="rounded border bg-background p-2 text-sm" value={assetId} onChange={e => setAssetId(e.target.value)} />
              <input aria-label="Asset approval receipt" placeholder="Asset approval receipt ID" className="rounded border bg-background p-2 text-sm" value={approvalId} onChange={e => setApprovalId(e.target.value)} />
              <input aria-label="Final QC evidence references" placeholder="Final QC evidence IDs, separated by commas" className="rounded border bg-background p-2 text-sm" value={qcRefs} onChange={e => setQcRefs(e.target.value)} />
              <select aria-label="Target Social platform" className="rounded border bg-background p-2 text-sm" value={platform} onChange={e => setPlatform(e.target.value)}><option value="youtube-shorts">YouTube Shorts</option><option value="instagram-reels">Instagram Reels</option><option value="facebook-reels">Facebook Reels</option><option value="tiktok">TikTok</option></select>
            </div>
            <button className="rounded border px-3 py-2 text-sm" type="button" onClick={prepareSocialHandoff}>Export pending Social draft</button>
            <p className="text-xs text-muted-foreground">Canonical Social Scheduler below remains responsible for validating owned assets, account authority, QC and publication approval.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
