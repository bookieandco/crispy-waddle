import type { NextApiRequest, NextApiResponse } from 'next';
import { createJtvOwnerClient, requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';
import { getJellyfinAdmissionStatus } from '../../../lib/jhadinatv/jellyfin-provider';

/**
 * Read-only, owner-authenticated commissioning probe.
 * "prepared" means the dependencies responded, NOT that broadcast rights or
 * physical device playback have been independently certified.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' }); return;
  }
  if (!(await requireJtvOwner(req, res))) return;
  const provider = getJellyfinAdmissionStatus();
  const signingConfigured = Buffer.byteLength(
    process.env.JHADINA_TV_STREAM_SIGNING_SECRET ?? '', 'utf8') >= 32;
  let storageReadable = false;
  try {
    const client = createJtvOwnerClient(req, res);
    const [watchlist, checkpoints] = await Promise.all([
      client.from('jtv_watchlist').select('media_id', { head: true, count: 'exact' }).limit(1),
      client.from('jtv_playback_checkpoints').select('media_id', { head: true, count: 'exact' }).limit(1),
    ]);
    storageReadable = !watchlist.error && !checkpoints.error;
  } catch { storageReadable = false; }

  const missing = [
    ...provider.missing,
    ...(!signingConfigured ? ['JHADINA_TV_STREAM_SIGNING_SECRET'] : []),
    ...(!storageReadable ? ['JTV_OWNER_STORAGE_READABLE'] : []),
  ];
  // Never disclose provider hostnames, API tokens, JWTs or user IDs.
  res.status(missing.length ? 503 : 200).json({
    source: 'jtv-postmerge-owner-readonly',
    ownerVerified: true,
    providerConfigPresent: provider.admitted,
    signingConfigured,
    storageReadable,
    preparedForHumanDeviceCanary: missing.length === 0,
    actualMediaRightsVerified: false,
    physicalDeviceVerified: false,
    liveCertified: false,
    missing,
  });
}
