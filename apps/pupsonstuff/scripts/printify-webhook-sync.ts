#!/usr/bin/env -S node --import tsx

import {
  createWebhook,
  listWebhooks,
  resolvePrintifyShopId,
  type PrintifyWebhookTopic,
} from '../lib/printify';
import { resolvePrintifyWebhookSecret } from '../lib/printify-webhook';

const REQUIRED_TOPICS: PrintifyWebhookTopic[] = [
  'order:created',
  'order:updated',
  'order:sent-to-production',
  'order:shipment:created',
  'order:shipment:delivered',
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const asJson = process.argv.includes('--json');
  const shopId = await resolvePrintifyShopId();
  const origin = required('PUPSON_PUBLIC_ORIGIN').replace(/\/$/, '');
  if (!origin.startsWith('https://')) {
    throw new Error('PUPSON_PUBLIC_ORIGIN must be HTTPS before Printify webhooks are registered.');
  }

  const targetUrl = `${origin}/api/printify/webhook`;
  const existing = await listWebhooks(shopId);
  const present = new Set(
    existing
      .filter((item) => item.url === targetUrl)
      .map((item) => item.topic)
  );

  const missing = REQUIRED_TOPICS.filter((topic) => !present.has(topic));
  const created: Array<{ id: string; topic: string; url: string }> = [];

  if (apply && missing.length > 0) {
    const secret = resolvePrintifyWebhookSecret();
    if (!secret) {
      throw new Error(
        'No Printify webhook signing secret is available. Configure PUPSON_PRINTIFY_WEBHOOK_SECRET or PRINTIFY_API_KEY.'
      );
    }
    if (secret.length < 32) {
      throw new Error('Resolved Printify webhook signing secret must be at least 32 characters.');
    }

    for (const topic of missing) {
      const webhook = await createWebhook(shopId, {
        topic,
        url: targetUrl,
        secret,
      });
      created.push({ id: webhook.id, topic: webhook.topic, url: webhook.url });
    }
  }

  const report = {
    mode: apply ? 'apply' : 'check',
    shopId,
    targetUrl,
    requiredTopics: REQUIRED_TOPICS,
    existingAtTarget: existing
      .filter((item) => item.url === targetUrl)
      .map(({ id, topic, url }) => ({ id, topic, url })),
    missingBeforeApply: missing,
    created,
    ready:
      apply
        ? missing.length === created.length
        : missing.length === 0,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Printify webhook target: ${targetUrl}`);
    console.log(`Existing required subscriptions: ${REQUIRED_TOPICS.length - missing.length}/${REQUIRED_TOPICS.length}`);
    if (missing.length) console.log(`Missing: ${missing.join(', ')}`);
    if (created.length) console.log(`Created: ${created.map((item) => item.topic).join(', ')}`);
    if (!apply && missing.length) {
      console.log('Read-only check complete. Re-run with --apply after the webhook secret is configured.');
    }
  }

  if (apply && created.length !== missing.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
