"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createRelayBrandBrief, rankRelayTrends, generateRelayDraftBatch,
  reviewRelayDraft, planRelayCalendar,
  type RelayBrandBrief, type RelayDraft, type RelayCalendarSlot,
  type RelayTrend, type SocialAccount, type JhadinaBrand, type SocialPlatform,
} from "@jhadina/social-core";

const BRAND_LABELS: Array<[JhadinaBrand, string]> = [
  ["pupsonstuff", "PupsonStuff"], ["atwood-bookie", "Atwood Bookie"],
  ["bookieandco", "Bookie & Co."], ["jhadina-music", "Jhadina Music"],
  ["jhadinatv", "JhadinaTV"], ["jhadina", "Jhadina"],
  ["overageos", "OverageOS"], ["truckeros", "TruckerOS"],
];
const CHANNELS: SocialPlatform[] = ["tiktok", "instagram", "youtube", "facebook", "threads", "x", "linkedin", "bluesky"];
const field = { width: "100%", padding: "12px 14px", border: "1px solid #d4dbd5", background: "#fff", color: "#24352b", borderRadius: 12, font: "inherit" };
const panel = { padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #e1e6e0", marginTop: 16 };
const button = { padding: "11px 16px", borderRadius: 999, border: 0, background: "#2f4439", color: "#fff", fontWeight: 700 as const, cursor: "pointer" };
const secondary = { ...button, border: "1px solid #ccd6cc", background: "#f7f9f6", color: "#30453a" };
const caption = { fontSize: 12, color: "#6b7a70", lineHeight: 1.5 };
const small = { fontSize: 12, fontWeight: 700 as const, marginBottom: 6, display: "block" };

export default function SocialStudioPage() {
  const [brand, setBrand] = useState<JhadinaBrand>("pupsonstuff");
  const [siteUrl, setSiteUrl] = useState("");
  const [positioning, setPositioning] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [trendUrl, setTrendUrl] = useState("");
  const [trendObservedAt, setTrendObservedAt] = useState("");
  const [trendTopic, setTrendTopic] = useState("");
  const [trendPattern, setTrendPattern] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("tiktok");
  const [format, setFormat] = useState<"short_video" | "carousel">("short_video");
  const [count, setCount] = useState(7);
  const [ownerId, setOwnerId] = useState("");
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [authMessage, setAuthMessage] = useState("Checking your Social account…");
  const [brief, setBrief] = useState<RelayBrandBrief | null>(null);
  const [drafts, setDrafts] = useState<RelayDraft[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<readonly RelayCalendarSlot[]>([]);
  const [error, setError] = useState("");
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/social/profiles", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Sign in to Social first.");
        if (!body.ownerUserId) throw new Error("Owner identity unavailable.");
        if (active) {
          setOwnerId(body.ownerUserId);
          setAccounts(body.data ?? []);
          setAuthMessage("Owner session verified. Draft generation stays on this device.");
        }
      })
      .catch((e: unknown) => { if (active) setAuthMessage(e instanceof Error ? e.message : "Social sign-in unavailable."); });
    return () => { active = false; };
  }, []);

  function clearDrafts() {
    setDrafts([]); setBrief(null); setTargets({}); setSlots([]); setError("");
  }

  function generate() {
    setError(""); setSlots([]);
    try {
      if (!ownerId) throw new Error("You need a valid owner session to prepare drafts.");
      // Manually submitted public reference, NOT claimed as verified social trend API data.
      const now = new Date().toISOString();
      const b = createRelayBrandBrief({
        id: "owner-brief:" + brand + ":" + now, ownerUserId: ownerId,
        brand, siteUrl, positioning, audience, offer,
        keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        evidenceRefs: ["owner-entered-brand-brief:" + brand],
        provenance: "owner_supplied", createdAt: now,
      });
      if (!trendObservedAt) throw new Error("Enter when the trend reference was actually observed; recency must not be guessed.");
      const observedAt = new Date(trendObservedAt).toISOString();
      const trend: RelayTrend = {
        id: "owner-trend:" + platform + ":" + now,
        platform, format, topic: trendTopic, pattern: trendPattern,
        sourceUrl: trendUrl, observedAt,
        evidenceRefs: ["owner-submitted-url:" + trendUrl], source: "owner_submitted",
      };
      const ranked = rankRelayTrends(b, [trend], now);
      const batch = generateRelayDraftBatch({ brief: b, trends: ranked, count, now });
      setBrief(b); setDrafts([...batch]); setTargets({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare draft batch.");
    }
  }

  const nextIndex = useMemo(() => drafts.findIndex((d) => d.review === "draft"), [drafts]);
  const active = nextIndex >= 0 ? drafts[nextIndex] : undefined;
  const accepted = useMemo(() => drafts.filter((d) => d.review === "accepted_for_planning"), [drafts]);
  const rejected = drafts.filter((d) => d.review === "rejected").length;

  function decide(decision: "accept" | "reject") {
    if (!active || !ownerId) return;
    try {
      const updated = reviewRelayDraft(active, decision, ownerId, new Date().toISOString());
      setDrafts((prior) => prior.map((d) => d.id === updated.id ? updated : d));
      setSlots([]);
    } catch (e) { setError(e instanceof Error ? e.message : "Review failed."); }
  }

  function makeCalendar() {
    setError("");
    try {
      if (!brief || !slotDate) throw new Error("Choose a schedule start date.");
      if (!accepted.length) throw new Error("Accept at least one idea first.");
      const planned = planRelayCalendar({
        brief, drafts: accepted, accounts, targetAccountByDraftId: targets,
        firstScheduledAt: new Date(slotDate).toISOString(), now: new Date().toISOString(),
      });
      setSlots(planned);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare calendar."); }
  }

  return <main style={{ minHeight: "100vh", background: "#f5f3ec", color: "#24352b", padding: "26px 14px 112px", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 700, margin: "auto" }}>
      <a href="/social" style={{ color: "#365e46", fontSize: 13 }}>← Social Command Center</a>
      <div style={{ fontSize: 12, letterSpacing: 2, marginTop: 18, color: "#67806f" }}>JHADINA / CREATIVE STUDIO</div>
      <h1 style={{ margin: "8px 0", fontSize: "clamp(33px, 9vw, 51px)", fontFamily: "Georgia, serif", fontWeight: 400 }}>From brand to content plan.</h1>
      <p style={{ lineHeight: 1.6, color: "#627568" }}>
        Original, evidence-linked storyboard ideas for your brands. Review them on your phone, then
        plan destinations. This is a local session preview, not AI-rendered videos or scheduled posts.
      </p>
      <div role="status" style={{ ...caption, padding: 12, background: "#e9eee7", borderRadius: 10 }}>{authMessage}</div>
      {error && <div role="alert" style={{ ...panel, background: "#feeae6", color: "#8b3b30" }}>{error}</div>}

      <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>1 · Your brand brief</h2>
        <label style={small} htmlFor="rs-brand">Business</label>
        <select id="rs-brand" value={brand} onChange={(e) => { setBrand(e.target.value as JhadinaBrand); clearDrafts(); }} style={field}>
          {BRAND_LABELS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {([
            ["Website (owner-supplied, not crawled)", siteUrl, setSiteUrl, "https://your-brand.com"],
            ["What makes it different?", positioning, setPositioning, "Specific, honest brand point of view"],
            ["Who is it for?", audience, setAudience, "People your business actually serves"],
            ["Featured offer / product", offer, setOffer, "Product to feature"],
            ["Niche keywords, comma-separated", keywords, setKeywords, "dog, portrait, gift"],
          ] as const).map(([name, value, setter, placeholder]) => (
            <label key={name}><span style={small}>{name}</span>
              <input style={field} value={value} onChange={(e) => { setter(e.target.value); clearDrafts(); }} placeholder={placeholder}/>
            </label>
          ))}
        </div>
      </section>

      <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>2 · Trend evidence</h2>
        <p style={caption}>Paste a real source you have permission to reference. We extract an original content structure from your description, not the source creator's script.</p>
        <label><span style={small}>Public reference URL</span>
          <input style={field} type="url" value={trendUrl} onChange={(e) => { setTrendUrl(e.target.value); clearDrafts(); }} placeholder="https://example.com/public-trend"/>
        </label>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label><span style={small}>When did you observe this reference? (required)</span><input type="datetime-local" style={field} value={trendObservedAt} onChange={(e) => { setTrendObservedAt(e.target.value); clearDrafts(); }}/></label>
          <label><span style={small}>Topic</span><input style={field} value={trendTopic} onChange={(e) => { setTrendTopic(e.target.value); clearDrafts(); }} placeholder="Dog portrait reveal"/></label>
          <label><span style={small}>Reusable format idea</span><input style={field} value={trendPattern} onChange={(e) => { setTrendPattern(e.target.value); clearDrafts(); }} placeholder="Before and after reveal"/></label>
          <label><span style={small}>Platform</span>
            <select style={field} value={platform} onChange={(e) => { setPlatform(e.target.value as SocialPlatform); clearDrafts(); }}>
              {CHANNELS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label><span style={small}>Output</span><select style={field} value={format} onChange={(e) => { setFormat(e.target.value as "short_video" | "carousel"); clearDrafts(); }}>
            <option value="short_video">Short video storyboard</option>
            <option value="carousel">Carousel slideshow storyboard</option>
          </select></label>
          <label><span style={small}>Ideas to prepare (1–30)</span>
            <input style={field} type="number" min={1} max={30} value={count} onChange={(e) => { setCount(Number(e.target.value)); clearDrafts(); }}/>
          </label>
        </div>
        <button type="button" onClick={generate} disabled={!ownerId} style={{ ...button, marginTop: 16 }}>Generate planning drafts</button>
        <p style={caption}>No generative provider call or expense. These are templated storyboards, not actual edited media.</p>
      </section>

      {drafts.length > 0 && <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>3 · Swipe review</h2>
        <p style={caption}>{accepted.length} accepted · {rejected} rejected · {drafts.length - accepted.length - rejected} remaining</p>
        {active ? <article
          onTouchStart={(e) => { touchStart.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const end = e.changedTouches[0]?.clientX;
            const start = touchStart.current;
            touchStart.current = null;
            if (start !== null && end !== undefined && Math.abs(end - start) > 90) decide(end > start ? "accept" : "reject");
          }}
          style={{ padding: 20, borderRadius: 20, background: "#edf1e9", border: "1px solid #d1dbce", touchAction: "pan-y" }}
        >
          <span style={caption}>{active.platform.toUpperCase()} · {active.format} · {nextIndex + 1}/{drafts.length}</span>
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 400 }}>{active.hook}</h3>
          <p>{active.caption}</p>
          <ol style={{ lineHeight: 1.7, paddingLeft: 22 }}>{active.storyboard.map((step, i) => <li key={i}>{step}</li>)}</ol>
          <p style={caption}>Source: {active.sourceTrendId} · Evidence retained in canonical Social project.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => decide("reject")} style={secondary}>← Pass</button>
            <button type="button" onClick={() => decide("accept")} style={button}>Keep idea →</button>
          </div>
          <p style={caption}>Swipe left to pass, right to keep. Keeping does NOT approve publication.</p>
        </article> : <p>All ideas reviewed. Your accepted concepts are ready for planning.</p>}
      </section>}

      {drafts.length > 0 && <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>4 · Calendar proposal</h2>
        <p style={caption}>A connected account and specific owner choice are required for every accepted idea. Planning never posts or schedules to a provider.</p>
        {accepted.map((draft) => <label key={draft.id} style={{ display: "block", padding: "12px 0", borderBottom: "1px solid #e4eae4" }}>
          <span style={small}>{draft.hook} · {draft.platform}</span>
          <select style={field} value={targets[draft.id] ?? ""} onChange={(e) => { setTargets((old) => ({ ...old, [draft.id]: e.target.value })); setSlots([]); }}>
            <option value="">Choose a connected account (required)</option>
            {accounts.filter((a) => a.userId === ownerId && a.brand === brand && a.platform === draft.platform && a.status === "connected")
              .map((a) => <option key={a.id} value={a.id}>{a.displayName} · {a.provider}</option>)}
          </select>
        </label>)}
        <label style={{ display: "block", marginTop: 15 }}><span style={small}>First proposed publish date/time</span>
          <input type="datetime-local" style={field} value={slotDate} onChange={(e) => { setSlotDate(e.target.value); setSlots([]); }}/>
        </label>
        <button type="button" style={{ ...button, marginTop: 14 }} onClick={makeCalendar} disabled={!accepted.length}>Build calendar preview</button>
        {slots.length > 0 && <div style={{ marginTop: 14 }}>
          {slots.map((slot) => <div key={slot.id} style={{ padding: "12px 0", borderBottom: "1px solid #e2e8e2" }}>
            <strong>{new Date(slot.scheduledAt).toLocaleString()}</strong>
            <div style={caption}>{slot.platform} · owner-reviewed storyboard · not queued</div>
          </div>)}
          <p style={{ ...caption, fontWeight: 700 }}>Next: create and QC real assets in Director, then separately request canonical Social publication approval. Nothing is published or persisted by this preview.</p>
          <a href="/social" style={{ color: "#365e46" }}>Open Social approval control plane →</a>
        </div>}
      </section>}
    </div>
  </main>;
}
