#!/usr/bin/env -S npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface VariantMatch {
  dimension: string;
  printifyVariantId: number;
  printifyVariantTitle: string;
}

interface GroupReport {
  fulfillmentProductId: string;
  status: 'RESOLVED' | 'PARTIAL' | 'UNRESOLVED';
  reason?: string;
  chosenBlueprint?: { blueprintId: number; title: string };
  chosenProvider?: { printProviderId: number; title: string };
  matchedVariants: VariantMatch[];
  artworkPlacement?: {
    requestedPrintArea: string;
    availablePlaceholderPositions: string[];
    suggestedPosition?: string;
    note: string;
  };
}

interface RunReport {
  generatedAt: string;
  blocked: boolean;
  blockedReason?: string;
  groups: GroupReport[];
}

export const LAUNCH_TARGETS = [
  {
    productId: 'frame1',
    variantId: 'canvas-12x16',
    label: '12×16 canvas',
    fulfillmentProductId: 'canvas',
    dimensionTokens: ['Size: 12×16 in'],
  },
  {
    productId: 'mugWhite',
    variantId: 'mug-11oz',
    label: '11oz white mug',
    fulfillmentProductId: 'mug',
    dimensionTokens: ['Size: 11oz', 'Color: White'],
  },
  {
    productId: 'concertShirt',
    variantId: 'tee-concert-m',
    label: 'medium black concert tee',
    fulfillmentProductId: 'tee-concert',
    dimensionTokens: ['Size: M', 'Color: Black'],
  },
] as const;

function matchesDimension(dimension: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => dimension.includes(token));
}

export function compileLaunchReview(report: RunReport) {
  const targets = LAUNCH_TARGETS.map((target) => {
    const reasons: string[] = [];
    const group = report.groups.find(
      (candidate) => candidate.fulfillmentProductId === target.fulfillmentProductId
    );

    if (!group) reasons.push(`Missing discovery group "${target.fulfillmentProductId}".`);
    if (report.blocked) {
      reasons.push(report.blockedReason || 'Live Printify catalog discovery was blocked.');
    }
    if (group?.status === 'UNRESOLVED') {
      reasons.push(group.reason || 'Printify catalog group is unresolved.');
    }
    if (!group?.chosenBlueprint) reasons.push('No chosen Printify blueprint.');
    if (!group?.chosenProvider) reasons.push('No chosen Printify print provider.');
    if (!group?.artworkPlacement?.suggestedPosition) {
      reasons.push('Print-area placement is ambiguous.');
    }

    const exactVariants = (group?.matchedVariants ?? []).filter((variant) =>
      matchesDimension(variant.dimension, target.dimensionTokens)
    );
    if (exactVariants.length !== 1) {
      reasons.push(
        exactVariants.length === 0
          ? `No exact catalog variant matched ${target.dimensionTokens.join(' + ')}.`
          : `More than one catalog variant matched ${target.dimensionTokens.join(' + ')}.`
      );
    }

    const exactVariant = exactVariants.length === 1 ? exactVariants[0] : undefined;
    const ready = reasons.length === 0;

    return {
      productId: target.productId,
      variantId: target.variantId,
      label: target.label,
      fulfillmentProductId: target.fulfillmentProductId,
      status: ready ? 'READY_FOR_SANDBOX_REVIEW' : 'BLOCKED',
      reasons,
      candidate: ready
        ? {
            provider: 'printify',
            // PupsonStuff submits raw blueprint/provider/variant Printify
            // line items. No shop product ID is required for this path.
            providerProductId: null,
            providerVariantId: String(exactVariant!.printifyVariantId),
            blueprintId: String(group!.chosenBlueprint!.blueprintId),
            printProviderId: String(group!.chosenProvider!.printProviderId),
            printArea: group!.artworkPlacement!.suggestedPosition!,
            certificationStatus: 'sandbox_verified',
          }
        : null,
      evidence: {
        blueprint: group?.chosenBlueprint ?? null,
        printProvider: group?.chosenProvider ?? null,
        exactVariant: exactVariant ?? null,
        artworkPlacement: group?.artworkPlacement ?? null,
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    discoveryGeneratedAt: report.generatedAt,
    discoveryBlocked: report.blocked,
    ready: targets.every((target) => target.status === 'READY_FOR_SANDBOX_REVIEW'),
    targets,
  };
}

function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportPath = path.join(
    __dirname,
    '..',
    'docs',
    'fulfillment',
    'catalog-mapping-report.json'
  );
  const outputPath = path.join(
    __dirname,
    '..',
    'docs',
    'fulfillment',
    'launch-catalog-review.json'
  );

  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as RunReport;
  const review = compileLaunchReview(report);
  writeFileSync(outputPath, JSON.stringify(review, null, 2));

  console.log(
    `Launch review: ${review.targets.filter((target) => target.status === 'READY_FOR_SANDBOX_REVIEW').length}/${review.targets.length} targets ready for sandbox review.`
  );
  console.log(`Report: ${outputPath}`);
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) main();
