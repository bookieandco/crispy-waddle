# JH-VOICE-HOST — Cloudflare Pages + optional Google Drive archive

**State:** source prepared; no hosting, new audio synthesis, public URL, Drive upload, token setup, billable inference or voice approval occurred.

## Decision

For **small public audition MP3s**, use a *dedicated* Cloudflare Pages Direct Upload project `jhadina-voice-audition`. Existing original MP3s are small static site assets; R2 is unnecessary for these and must not be created without a demonstrated need. R2 is a later option for private original WAV masters and files larger than Cloudflare Pages' 25 MiB per-file limit. Google Drive is a private archive/collaboration destination, not the canonical browser audio CDN. Drive sharing and inline media are subject to provider access controls and often need authentication. Never publish private original or signed approval artifacts as Pages assets.

**Cloudflare Workers AI** offers fixed-provider TTS such as Deepgram Aura, but those voices are **not** automatically the speaker in original Qwen VoiceDesign candidate 2. A stock TTS voice must not be promoted into `voice:jhadina:canonical:v1`. Cloudflare AI Gateway can route a consented external Qwen service but does not run an arbitrary Qwen custom speaker model by itself. No paid TTS call or voice design was invoked.

## Existing reference and preview artifacts

- Original creative reference: `apps/jhadina-web/public/jhadina-voice-audition/candidate-2.mp3`.
- Provenance in original manifest: `jhadina-audition:1274`; unapproved, original WAV SHA-256 `516181c853b1e8fc00c5e60975cd60c8ed7eea0142d732b6ec4d3508873d60ab`.
- Four new **unrendered** specifications in `docs/architecture/jhadina-candidate2-voice-v2-audition.json`, as created by PR #1347.
- `scripts/jhadina-voice-pages-build.mjs` packages a strictly allowlisted 7-asset static site and SHA-256 provenance. It never renders or creates audio.
- v2 MP3s are excluded unless all four exist, manifest declares them all unapproved, and **all SHA-256 hashes match**. Requires a separate publisher from verified Qwen run receipts that writes MP3 hashes; no bypass for partially published takes.
- `.github/workflows/jhadina-voice-cloudflare-pages.yml` tests source on PR; upload is manual, requires explicit `DEPLOY_UNAPPROVED_VOICE_PREVIEW` on exact `main`, and uses separate GitHub Environment `Jhadina_voice_cloudflare_preview`.
- No custom production domain, production voice API, GPU, R2, DB, Supabase or other store touched.

## Owner setup for optional live preview

1. In Cloudflare Pages create a new **Direct Upload** project named `jhadina-voice-audition`, with no paid plan, no custom domain, no AI binding or Functions.
2. In GitHub repository Settings → Environments create `Jhadina_voice_cloudflare_preview`, with an explicit required reviewer if available. Do not copy/reuse the `Pupsonstuff_cloudflare_preview` environment or its secrets.
3. Set environment secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, with the API token scoped to account **Cloudflare Pages: Edit** and a dedicated account/project where possible. Never paste keys in chat, code, logs, artifacts or a public Drive file.
4. Merge ancestor PR #1345 and stacked #1347 in that order, then merge this change once source checks/review pass.
5. Under GitHub Actions → Jhadina Voice Cloudflare Static Audition → Run workflow on **main**, explicitly select `DEPLOY_UNAPPROVED_VOICE_PREVIEW`. Inspect the actual resulting Wrangler URL and test all four original MP3 players on an iPhone; no URL is invented beforehand.
6. If publishing the 02A–D variants, render them through a separate explicitly cost-authorized model and convert to MP3, then record **actual** artifact hashes in unapproved v2 manifest and pass this source gate before rerunning preview deployment. Do not claim that new VoiceDesign takes match the candidate-2 speaker without acoustic QC.

## Google Drive alternative / backup

- Google Drive may store a private `Jhadina Voice Auditions` folder containing source WAV/MP3, manifest and owner scoring notes.
- Keep folder private. Only share the exact audio with named reviewers, and do not assume a generic Drive `/file/d/` share page is a stable public MP3 source for HTML audio elements.
- A Drive upload must use an authenticated connector file reference and verify the destination Drive metadata; no Drive upload has been performed as part of this source-only PR.
- The production speaker reference/approval receipts, once created, require an authenticated private store with checksums/revocation—not a public preview.

## Future sequence: JH-VOICE-HOST.04–.08

1. Configure dedicated Pages credentials/project after owner review.
2. Verify a real Pages preview and original candidate-2 browser/iPhone playback, URL and SHA receipt.
3. Optionally archive audio/manifest with private Drive file IDs and verified content digests.
4. Render v2 candidates **only** after cost/GPU permission, verify all hashes and publish unapproved audition package.
5. Compare with original candidate 2, run owner approval and speaker identity/QC, update the canonical voice registry only after external acceptance.
