#!/usr/bin/env -S npx tsx
//
// scripts/printify-catalog-sync.ts
//
// DRY RUN ONLY. This script never writes to data/hotspots.ts and never
// calls createProduct()/submitOrder()/anything mutating on Printify —
// read-only catalog discovery, start to finish. Existing PupsonStuff
// product IDs, hotspot data, and storefront UX are untouched; this is a
// reconnaissance/reporting tool, not a migration.
//
// Uses lib/printify.ts as the sole Printify API boundary — no second
// client, no raw fetch() calls to api.printify.com anywhere in this
// file. Every catalog lookup below goes through the same typed
// functions app/api/* routes would eventually use.
//
// What it does:
//   1. Reads data/hotspots.ts and groups every sellable hotspot by its
//      current (placeholder) fulfillment.productId — hotspots that
//      share a placeholder ID (the 6 canvas frames, the 2 mugs) share
//      one real physical Printify product too, so they're one catalog
//      lookup, not six.
//   2. For each group, searches the real Printify blueprint catalog
//      (listBlueprints()) for title matches against the product type's
//      keywords, ranks candidates, and for the top candidates fetches
//      real print providers (listPrintProvidersForBlueprint()) and
//      real variants (listVariants()).
//   3. Matches each group's real customization (sizes/colors from
//      data/hotspots.ts) against the real variant options returned by
//      Printify, and cross-references the group's printArea.name
//      against the real placeholder positions on those variants.
//   4. Writes a dry-run report (JSON + Markdown) to
//      docs/fulfillment/catalog-mapping-report.{json,md} — candidate
//      blueprint/provider/variant IDs, per-dimension matches, and an
//      explicit UNRESOLVED/PARTIAL/RESOLVED status per group. Nothing
//      here is invented: every ID in a RESOLVED or PARTIAL entry is a
//      real ID that came back from a real Printify API response in
//      this run. A group with no live data becomes UNRESOLVED with a
//      stated reason — never a guessed ID standing in for a real one.
//
// Usage:
//   cp .env.example .env.local   # fill in PRINTIFY_API_KEY
//   npm run printify:sync
//
// Needs only PRINTIFY_API_KEY — the catalog endpoints this script calls
// (/v1/catalog/*) are not shop-scoped, unlike products/orders/uploads.
// PRINTIFY_SHOP_ID is irrelevant here and never read by this script.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { hotspots, Hotspot, ProductType } from "../data/hotspots";
import {
  listBlueprints,
  listPrintProvidersForBlueprint,
  listVariants,
  PrintifyApiError,
  PrintifyBlueprint,
  PrintifyCatalogVariant,
  PrintifyPrintProviderSimple,
} from "../lib/printify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "docs", "fulfillment");
const JSON_OUT = path.join(OUT_DIR, "catalog-mapping-report.json");
const MD_OUT = path.join(OUT_DIR, "catalog-mapping-report.md");

// How many top-scoring blueprint candidates to actually try fetching
// providers/variants for, per group. Keyword scoring alone isn't
// trustworthy enough to commit to the #1 result blind — but trying
// every scored blueprint would be a lot of API calls for a catalog this
// size, so this is a deliberate, stated tradeoff, not an oversight.
const MAX_BLUEPRINT_CANDIDATES = 5;
// Per candidate blueprint, how many print providers to actually check
// variants for. Printify's own ordering has no documented quality
// signal, so this is "try the first few," not "try the best."
const MAX_PROVIDERS_PER_BLUEPRINT = 3;

const KEYWORDS_BY_PRODUCT_TYPE: Record<string, string[]> = {
  canvas: ["canvas"],
  pillow: ["pillow"],
  bottle: ["water bottle", "bottle", "tumbler"],
  mug: ["mug"],
  hoodie: ["hoodie"],
  shirt: ["t-shirt", "tee"],
  shirts: ["t-shirt", "tee"],
  tote: ["tote bag", "tote"],
};

// ---------------------------------------------------------------------
// Grouping: data/hotspots.ts -> one target per real fulfillment product
// ---------------------------------------------------------------------

export interface FulfillmentGroup {
  fulfillmentProductId: string;
  productType: ProductType;
  memberHotspots: { id: string; name: string }[];
  sizes?: string[];
  colors?: string[];
  printAreaName: string;
  searchKeywords: string[];
}

export function buildFulfillmentGroups(): FulfillmentGroup[] {
  const groups = new Map<string, FulfillmentGroup>();
  for (const h of hotspots as Hotspot[]) {
    if (!h.fulfillment) continue; // checkout/portraitStudio hotspots — not real products
    const key = h.fulfillment.productId;
    let g = groups.get(key);
    if (!g) {
      g = {
        fulfillmentProductId: key,
        productType: h.product,
        memberHotspots: [],
        sizes: h.customization?.sizes,
        colors: h.customization?.colors,
        printAreaName: h.fulfillment.printArea.name,
        searchKeywords: KEYWORDS_BY_PRODUCT_TYPE[h.product] ?? [h.product],
      };
      groups.set(key, g);
    }
    g.memberHotspots.push({ id: h.id, name: h.name });
  }
  return Array.from(groups.values());
}

// ---------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------

interface BlueprintCandidate {
  blueprintId: number;
  title: string;
  brand: string;
  model: string;
  matchScore: number;
  matchedKeywords: string[];
}

interface VariantMatch {
  dimension: string; // e.g. "Size: M, Color: Black"
  printifyVariantId: number;
  printifyVariantTitle: string;
}

interface ArtworkPlacement {
  requestedPrintArea: string;
  availablePlaceholderPositions: string[];
  suggestedPosition?: string;
  note: string;
}

export type GroupStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED";

export interface GroupReport {
  fulfillmentProductId: string;
  productType: ProductType;
  memberHotspots: { id: string; name: string }[];
  searchKeywords: string[];
  status: GroupStatus;
  reason?: string;
  blueprintCandidates: BlueprintCandidate[];
  chosenBlueprint?: BlueprintCandidate;
  providerCandidates?: { printProviderId: number; title: string }[];
  chosenProvider?: { printProviderId: number; title: string };
  matchedVariants: VariantMatch[];
  unmatchedCustomization: string[];
  artworkPlacement?: ArtworkPlacement;
}

export function scoreBlueprint(bp: PrintifyBlueprint, keywords: string[]): number {
  const title = bp.title.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (title.includes(kw.toLowerCase())) score += kw.split(" ").length;
  }
  return score;
}

export function matchedKeywordsFor(bp: PrintifyBlueprint, keywords: string[]): string[] {
  const title = bp.title.toLowerCase();
  return keywords.filter((kw) => title.includes(kw.toLowerCase()));
}

/** Exact string match first; falls back to comparing the numeric tokens
 * in each string (handles "12×16 in" vs. Printify's own "12″ x 16″"-
 * style variant titles, which will never match as plain strings). Sizes
 * with no digits at all (S/M/L/XL) rely on the exact-match branch only —
 * no numeric fallback exists for those, so a real mismatch there stays a
 * real mismatch, not a false positive. */
export function sizeMatches(hotspotSize: string, variantSize: string | undefined): boolean {
  const hs = hotspotSize.trim().toLowerCase();
  const vs = (variantSize ?? "").trim().toLowerCase();
  if (!vs) return false;
  if (hs === vs) return true;
  const hsNums = hs.match(/\d+/g);
  const vsNums = vs.match(/\d+/g);
  if (hsNums && vsNums && hsNums.length && vsNums.length) {
    return [...hsNums].sort().join(",") === [...vsNums].sort().join(",");
  }
  return false;
}

export function colorMatches(hotspotColor: string, variantColor: string | undefined): boolean {
  const hc = hotspotColor.trim().toLowerCase();
  const vc = (variantColor ?? "").trim().toLowerCase();
  if (!vc) return false;
  return hc === vc || vc.includes(hc) || hc.includes(vc);
}

export function matchVariants(
  group: FulfillmentGroup,
  variants: PrintifyCatalogVariant[]
): { matched: VariantMatch[]; unmatched: string[] } {
  const sizes = group.sizes && group.sizes.length > 0 ? group.sizes : [null];
  const colors = group.colors && group.colors.length > 0 ? group.colors : [null];

  const matched: VariantMatch[] = [];
  const unmatched: string[] = [];

  for (const size of sizes) {
    for (const color of colors) {
      const label =
        [size ? `Size: ${size}` : null, color ? `Color: ${color}` : null]
          .filter(Boolean)
          .join(", ") || "(no size/color constraint on this listing)";

      const found = variants.find(
        (v) =>
          (size === null || sizeMatches(size, v.options.size)) &&
          (color === null || colorMatches(color, v.options.color))
      );

      if (found) {
        matched.push({ dimension: label, printifyVariantId: found.id, printifyVariantTitle: found.title });
      } else {
        unmatched.push(label);
      }
    }
  }
  return { matched, unmatched };
}

export function resolveArtworkPlacement(
  group: FulfillmentGroup,
  variants: PrintifyCatalogVariant[]
): ArtworkPlacement {
  const positions = new Set<string>();
  for (const v of variants) for (const p of v.placeholders ?? []) positions.add(p.position);
  const available = Array.from(positions);
  const requested = group.printAreaName.toLowerCase();

  let suggested: string | undefined;
  if (available.includes(requested)) suggested = requested;
  else if (requested.includes("front") && available.includes("front")) suggested = "front";
  else if (requested.includes("back") && available.includes("back")) suggested = "back";
  else if (available.length === 1) suggested = available[0];

  return {
    requestedPrintArea: group.printAreaName,
    availablePlaceholderPositions: available,
    suggestedPosition: suggested,
    note: suggested
      ? `PupsonStuff's "${group.printAreaName}" print area maps to this blueprint's real "${suggested}" placeholder position.`
      : `No confident match between PupsonStuff's "${group.printAreaName}" print area name and this blueprint's real placeholder positions (${available.join(", ") || "none returned"}) — needs a human decision, not a guess.`,
  };
}

export function allCustomizationLabels(group: FulfillmentGroup): string[] {
  const sizes = group.sizes && group.sizes.length > 0 ? group.sizes : [null];
  const colors = group.colors && group.colors.length > 0 ? group.colors : [null];
  const labels: string[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      labels.push(
        [size ? `Size: ${size}` : null, color ? `Color: ${color}` : null]
          .filter(Boolean)
          .join(", ") || "(no size/color constraint on this listing)"
      );
    }
  }
  return labels;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function matchGroup(group: FulfillmentGroup, blueprints: PrintifyBlueprint[]): Promise<GroupReport> {
  const base = {
    fulfillmentProductId: group.fulfillmentProductId,
    productType: group.productType,
    memberHotspots: group.memberHotspots,
    searchKeywords: group.searchKeywords,
  };

  const scored = blueprints
    .map((bp) => ({ bp, score: scoreBlueprint(bp, group.searchKeywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_BLUEPRINT_CANDIDATES);

  if (scored.length === 0) {
    return {
      ...base,
      status: "UNRESOLVED",
      reason: `No Printify blueprint title matched any of [${group.searchKeywords.join(", ")}]. Either the keyword list needs expanding, or this product type genuinely isn't in Printify's catalog under an obvious name — needs a human to search Printify's dashboard directly.`,
      blueprintCandidates: [],
      matchedVariants: [],
      unmatchedCustomization: allCustomizationLabels(group),
    };
  }

  const blueprintCandidates: BlueprintCandidate[] = scored.map(({ bp, score }) => ({
    blueprintId: bp.id,
    title: bp.title,
    brand: bp.brand,
    model: bp.model,
    matchScore: score,
    matchedKeywords: matchedKeywordsFor(bp, group.searchKeywords),
  }));

  for (const candidate of blueprintCandidates) {
    let providers: PrintifyPrintProviderSimple[];
    try {
      providers = await listPrintProvidersForBlueprint(candidate.blueprintId);
      await delay(200);
    } catch (err) {
      console.warn(`    blueprint ${candidate.blueprintId} (${candidate.title}): failed to list print providers — ${err}`);
      continue;
    }
    if (providers.length === 0) continue;

    for (const provider of providers.slice(0, MAX_PROVIDERS_PER_BLUEPRINT)) {
      try {
        const variantsResp = await listVariants(candidate.blueprintId, provider.id);
        await delay(200);
        const { matched, unmatched } = matchVariants(group, variantsResp.variants);
        if (matched.length > 0) {
          return {
            ...base,
            status: unmatched.length === 0 ? "RESOLVED" : "PARTIAL",
            blueprintCandidates,
            chosenBlueprint: candidate,
            providerCandidates: providers.map((p) => ({ printProviderId: p.id, title: p.title })),
            chosenProvider: { printProviderId: provider.id, title: provider.title },
            matchedVariants: matched,
            unmatchedCustomization: unmatched,
            artworkPlacement: resolveArtworkPlacement(group, variantsResp.variants),
          };
        }
      } catch (err) {
        console.warn(
          `    blueprint ${candidate.blueprintId}, provider ${provider.id} (${provider.title}): failed to list variants — ${err}`
        );
      }
    }
  }

  return {
    ...base,
    status: "UNRESOLVED",
    reason:
      "Found candidate blueprint(s) by keyword match, but no print-provider/variant combination among the ones checked had a variant matching this listing's required sizes/colors. A human needs to either widen MAX_PROVIDERS_PER_BLUEPRINT/MAX_BLUEPRINT_CANDIDATES and re-run, or pick a blueprint manually.",
    blueprintCandidates,
    matchedVariants: [],
    unmatchedCustomization: allCustomizationLabels(group),
  };
}

// ---------------------------------------------------------------------
// Report writing
// ---------------------------------------------------------------------

interface RunReport {
  generatedAt: string;
  blocked: boolean;
  blockedReason?: string;
  groups: GroupReport[];
}

function blockedGroupReport(group: FulfillmentGroup, reason: string): GroupReport {
  return {
    fulfillmentProductId: group.fulfillmentProductId,
    productType: group.productType,
    memberHotspots: group.memberHotspots,
    searchKeywords: group.searchKeywords,
    status: "UNRESOLVED",
    reason,
    blueprintCandidates: [],
    matchedVariants: [],
    unmatchedCustomization: allCustomizationLabels(group),
  };
}

function statusEmoji(status: GroupStatus): string {
  if (status === "RESOLVED") return "✅";
  if (status === "PARTIAL") return "⚠️";
  return "❌";
}

function renderMarkdown(report: RunReport): string {
  const lines: string[] = [];
  lines.push("# Printify Catalog Mapping Report (dry run)");
  lines.push("");
  lines.push(
    `Generated ${report.generatedAt} by \`scripts/printify-catalog-sync.ts\`. **Dry run only — nothing in \`data/hotspots.ts\` was changed by generating this report.**`
  );
  lines.push("");

  if (report.blocked) {
    lines.push(`> ⛔ **This run could not reach the live Printify catalog.** ${report.blockedReason}`);
    lines.push(
      "> Every group below is therefore UNRESOLVED with no candidate data — that's the honest result of not being able to query Printify, not a claim that these products have no match. Re-run with real credentials/network access to get real candidates."
    );
    lines.push("");
  }

  const counts = { RESOLVED: 0, PARTIAL: 0, UNRESOLVED: 0 };
  for (const g of report.groups) counts[g.status]++;
  lines.push(
    `**${report.groups.length} fulfillment groups** (covering ${report.groups.reduce((n, g) => n + g.memberHotspots.length, 0)} storefront listings) — ${counts.RESOLVED} resolved, ${counts.PARTIAL} partial, ${counts.UNRESOLVED} unresolved.`
  );
  lines.push("");

  for (const g of report.groups) {
    lines.push(`## ${statusEmoji(g.status)} ${g.fulfillmentProductId} — ${g.productType}`);
    lines.push("");
    lines.push(
      `**Storefront listings using this fulfillment target:** ${g.memberHotspots.map((h) => `${h.name} (\`${h.id}\`)`).join(", ")}`
    );
    lines.push("");
    lines.push(`**Status:** ${g.status}${g.reason ? ` — ${g.reason}` : ""}`);
    lines.push("");

    if (g.blueprintCandidates.length > 0) {
      lines.push("**Candidate blueprints** (keyword-scored, not confirmed unless chosen below):");
      lines.push("");
      lines.push("| Blueprint ID | Title | Brand | Model | Score | Matched on |");
      lines.push("|---|---|---|---|---|---|");
      for (const c of g.blueprintCandidates) {
        const chosen = g.chosenBlueprint?.blueprintId === c.blueprintId ? " ✅" : "";
        lines.push(
          `| ${c.blueprintId}${chosen} | ${c.title} | ${c.brand} | ${c.model} | ${c.matchScore} | ${c.matchedKeywords.join(", ")} |`
        );
      }
      lines.push("");
    }

    if (g.chosenProvider) {
      lines.push(`**Chosen print provider:** ${g.chosenProvider.title} (ID \`${g.chosenProvider.printProviderId}\`)`);
      lines.push("");
    }

    if (g.matchedVariants.length > 0) {
      lines.push("**Matched variants:**");
      lines.push("");
      lines.push("| Dimension | Printify Variant ID | Printify Variant Title |");
      lines.push("|---|---|---|");
      for (const v of g.matchedVariants) {
        lines.push(`| ${v.dimension} | ${v.printifyVariantId} | ${v.printifyVariantTitle} |`);
      }
      lines.push("");
    }

    if (g.unmatchedCustomization.length > 0) {
      lines.push(`**Unresolved dimensions:** ${g.unmatchedCustomization.join("; ")}`);
      lines.push("");
    }

    if (g.artworkPlacement) {
      lines.push(
        `**Artwork placement:** requested "${g.artworkPlacement.requestedPrintArea}" — ${g.artworkPlacement.note}`
      );
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const groups = buildFulfillmentGroups();
  mkdirSync(OUT_DIR, { recursive: true });

  const apiKey = process.env.PRINTIFY_API_KEY;
  if (!apiKey) {
    const reason =
      "PRINTIFY_API_KEY is not configured — cannot query the live Printify catalog. Copy .env.example to .env.local and fill in a real key, then re-run.";
    const report: RunReport = {
      generatedAt: new Date().toISOString(),
      blocked: true,
      blockedReason: reason,
      groups: groups.map((g) => blockedGroupReport(g, reason)),
    };
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    writeFileSync(MD_OUT, renderMarkdown(report));
    console.error(`BLOCKED: ${reason}`);
    console.error(`Wrote an all-unresolved report anyway: ${MD_OUT}`);
    process.exitCode = 1;
    return;
  }

  let blueprints: PrintifyBlueprint[];
  try {
    console.log("Fetching the full Printify blueprint catalog...");
    blueprints = await listBlueprints();
    console.log(`Fetched ${blueprints.length} blueprints.`);
  } catch (err) {
    const reason =
      err instanceof PrintifyApiError
        ? `Printify API error (HTTP ${err.status}): ${err.message}`
        : `Could not reach api.printify.com: ${String(err)}`;
    const report: RunReport = {
      generatedAt: new Date().toISOString(),
      blocked: true,
      blockedReason: reason,
      groups: groups.map((g) => blockedGroupReport(g, reason)),
    };
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    writeFileSync(MD_OUT, renderMarkdown(report));
    console.error(`BLOCKED: ${reason}`);
    console.error(`Wrote an all-unresolved report anyway: ${MD_OUT}`);
    process.exitCode = 1;
    return;
  }

  const groupReports: GroupReport[] = [];
  for (const group of groups) {
    console.log(`\nMatching ${group.fulfillmentProductId} (${group.productType}, keywords: ${group.searchKeywords.join(", ")})...`);
    const result = await matchGroup(group, blueprints);
    console.log(`  -> ${result.status}${result.chosenBlueprint ? ` (blueprint ${result.chosenBlueprint.blueprintId}: ${result.chosenBlueprint.title})` : ""}`);
    groupReports.push(result);
  }

  const report: RunReport = {
    generatedAt: new Date().toISOString(),
    blocked: false,
    groups: groupReports,
  };
  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  writeFileSync(MD_OUT, renderMarkdown(report));

  const counts = { RESOLVED: 0, PARTIAL: 0, UNRESOLVED: 0 };
  for (const g of groupReports) counts[g.status]++;
  console.log(
    `\nDone. ${counts.RESOLVED} resolved, ${counts.PARTIAL} partial, ${counts.UNRESOLVED} unresolved out of ${groupReports.length} fulfillment groups.`
  );
  console.log(`Report: ${MD_OUT}`);
  console.log("This is a dry run — data/hotspots.ts was not modified. Review the report before applying anything.");
}

// Only auto-run when executed directly (`tsx scripts/printify-catalog-sync.ts`
// / `npm run printify:sync`) — NOT when another module imports from this
// file (e.g. a test importing `matchGroup` for unit testing). Without this
// guard, importing this file for any reason would trigger a full live run
// as a side effect, which for a script whose whole job is "don't touch
// anything until reviewed" would be a real footgun, not a hypothetical one.
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exitCode = 1;
  });
}
