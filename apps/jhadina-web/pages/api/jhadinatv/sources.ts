import type { NextApiRequest, NextApiResponse } from 'next';
import { assertMediaRight } from '@jhadina/tv-core';
import { jhadinaTVServerRegistry } from '../../../lib/jhadinatv/server-catalog';
import { getJellyfinProxyConfig } from '../../../lib/jhadinatv/jellyfin-provider';
import { jellyfinAssetIsAccessible, jtvEvidenceFingerprint } from '../../../lib/jhadinatv/jellyfin-access';
import { requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';
import { createJtvStreamCapability, type JtvStreamAudience, type JtvStreamMode } from '../../../lib/jhadinatv/stream-capability';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<NextApiResponse | void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const ownerId = await requireJtvOwner(req, res);
  if (!ownerId) return;

  const config = getJellyfinProxyConfig();
  const secret = process.env.JHADINA_TV_STREAM_SIGNING_SECRET ?? '';
  if (!config || Buffer.byteLength(secret) < 32) {
    return res.status(503).json({ error: 'JhadinaTV secure source admission is not configured.' });
  }

  // Other providers must implement their own entitlement + secure URL admission.
  const provider = typeof req.query.provider === 'string' ? req.query.provider : '';
  if (provider !== 'jellyfin') return res.status(403).json({ error: 'Provider has no secure playback adapter.' });
  const mediaId = typeof req.query.id === 'string' ? req.query.id : '';
  const mode: JtvStreamMode = mediaId.startsWith('jellyfin-live:') ? 'live' : 'vod';
  const assetId = mediaId.replace(/^jellyfin(?:-live)?:/, '');
  if (!/^jellyfin(?:-live)?:[A-Za-z0-9._:-]{1,160}$/.test(mediaId)) {
    return res.status(400).json({ error: 'Invalid Jellyfin media identity.' });
  }

  const territory = process.env.JHADINA_TV_TERRITORY?.trim();
  if (config.territories?.length && (!territory || !config.territories.includes(territory))) {
    return res.status(403).json({ error: 'Media rights are unavailable in this territory.' });
  }
  if (!(await jellyfinAssetIsAccessible(config, assetId, mode))) {
    return res.status(404).json({ error: 'Media is not available to the configured Jellyfin user.' });
  }

  const evidence = jtvEvidenceFingerprint(config.rightsEvidenceIds);
  const tokenized = (url: string, audience: JtvStreamAudience): string => {
    const sourceUrl = new URL(url);
    if (sourceUrl.protocol !== 'https:' || sourceUrl.pathname !== '/api/jhadinatv/jellyfin/stream' ||
      sourceUrl.searchParams.get('id') !== assetId || sourceUrl.searchParams.get('mode') !== mode) {
      throw new Error('Source does not match the authorized Jellyfin asset.');
    }
    sourceUrl.searchParams.set('token', createJtvStreamCapability({
      ownerId, assetId, mode, audience, territory: territory ?? '', rightsEvidence: evidence,
    }, secret));
    return sourceUrl.toString();
  };

  try {
    const sources = await jhadinaTVServerRegistry.resolveSources(provider, mediaId);
    const scoped = sources.map((entry) => {
      const admitted = assertMediaRight(entry.source, 'playback', new Date(), territory);
      const mayCast = config.rights.includes('casting') && admitted.authorization?.rights?.includes('casting');
      if (mayCast) assertMediaRight(admitted, 'casting', new Date(), territory);
      return {
        providerId: entry.providerId,
        source: {
          ...admitted,
          url: tokenized(admitted.url, 'local'),
          castUrl: mayCast ? tokenized(admitted.url, 'cast') : undefined,
        },
      };
    });
    return res.status(200).json({ sources: scoped, territory });
  } catch {
    return res.status(403).json({ error: 'Media source was not admitted.' });
  }
}
