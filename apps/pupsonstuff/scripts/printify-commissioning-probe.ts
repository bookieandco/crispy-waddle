#!/usr/bin/env -S node --import tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  listPrintProvidersForBlueprint,
  listShops,
  listVariants,
} from '../lib/printify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'fulfillment', 'printify-commissioning-probe.json');
const MUG_BLUEPRINT_ID = 68;

async function main() {
  if (!process.env.PRINTIFY_API_KEY) {
    throw new Error('PRINTIFY_API_KEY is required.');
  }

  const shops = await listShops();
  const providers = await listPrintProvidersForBlueprint(MUG_BLUEPRINT_ID);
  const mugProviders = [];

  for (const provider of providers) {
    try {
      const response = await listVariants(MUG_BLUEPRINT_ID, provider.id);
      mugProviders.push({
        printProviderId: provider.id,
        printProviderTitle: provider.title,
        variants: response.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          options: variant.options,
          printAreas: [...new Set((variant.placeholders ?? []).map((p) => p.position))],
          decorationMethods: variant.decoration_methods ?? [],
        })),
      });
    } catch (error) {
      mugProviders.push({
        printProviderId: provider.id,
        printProviderTitle: provider.title,
        error: error instanceof Error ? error.message : String(error),
        variants: [],
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    shops: shops.map((shop) => ({
      id: shop.id,
      title: shop.title,
      salesChannel: shop.sales_channel,
    })),
    mugBlueprint: {
      blueprintId: MUG_BLUEPRINT_ID,
      title: 'Mug 11oz',
      providers: mugProviders,
    },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
