# Facebook all-time archive — local-only acceptance and aggregate audit

**Status:** Draft PR #1351. The owner-only all-time ZIP exists in connected Drive and is approximately 649 MiB. Private archive bytes were **not** read here: connected raw download/materialization both returned HTTP 413 at the 256 MiB ceiling.

## What the importer now provides in source
- Browser `/memory/facebook` accepts local JSON/ZIP files without forwarding archives to Jhadina, Vercel, Cloudflare or GitHub.
- It scans only a bounded ZIP central directory (up to 60,000 metadata entries / 24 MiB) and eligible posts/comments JSON. Messengers, friends, media, advertising and non-owner profile/page posts are never intentionally extracted.
- When more than 80 eligible writing JSON files exist, the importer chooses positions spanning the directory, retains both post/comment types where present, and discloses discarded eligible files rather than claiming completeness.
- It continues a bounded local sample after 2,500 entries to preserve additional historic years, with a 2,500-sample memory cap and a deterministic, year-aware replacement policy.
- Existing limits: 8 MiB per eligible JSON, 32 MiB decoded JSON per archive, max six selected ZIP/JSON files. These are **sample limits**, not exhaustive-account coverage.
- The new `Copy aggregate audit counts` control is explicitly owner-triggered. It copies year-level post/comment sample counts, eligible JSON files read/skipped and partial status. No original filenames, writing, comments, source paths, specific timestamps or Drive URLs are included. Clipboard fallback shows a local select-and-copy text area.

## Real owner-controlled iPhone acceptance (not yet completed)
1. The owner must have access to an authenticated preview/deployment of Jhadina; source code alone does not create a live `/memory/facebook` page.
2. In iPhone Files, make the ZIP locally available or accessible via Files provider. Use the browser file picker; do **not** attach the private archive to GitHub/CI, a public URL or a chat.
3. Open `/memory/facebook` on the same authenticated app origin and select only the local ZIP. Confirm that no network request uploads archive bytes. Record whether ZIP directory scan succeeds without freezing Safari; cancellation must work.
4. Read the on-device year table and partial-preview warning. Use `Copy aggregate audit counts` to share **only the resulting counts** for code-provable follow-up. Never paste or share example posts in an audit.
5. If ZIP is unsupported, only then attempt a private local Posts-and-Comments-only JSON export or a smaller year-sliced export. Preserve the original file, do not re-export preemptively.
6. Any owner-selected interaction preference is submitted separately as a short pending Memory candidate; activate only after the canonical Approval Center and a live two-account/forget test with healthy durable storage.

## Unproven
- Actual ZIP internal format, member count, compression method, historical earliest/latest year, owner-attribution precision and uncompressed writing count.
- Actual 649 MiB iPhone Files provider and Safari WebKit performance, including memory pressure and cancellation behavior.
- Live owner authentication, Supabase SWLC restoration, Cloudflare D1 commissioning, approval or next-session recall.

## Release boundary
This is an **audit-ready source path**, not proof that the all-time archive was parsed, Jhadina learned from it, or an authorized deployment occurred. Keep PR #1351 draft until exact-head CI and external evidence are satisfied.
