import type { NextApiRequest, NextApiResponse } from 'next';
import { requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';
import { getAuthorizedJellyfinSeries } from '../../../lib/jhadinatv/jellyfin-provider';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!(await requireJtvOwner(req, res))) return;
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!/^jellyfin:[A-Za-z0-9._:-]{1,160}$/.test(id)) {
    res.status(400).json({ error: 'Invalid series identity' }); return;
  }
  const hierarchy = await getAuthorizedJellyfinSeries(id);
  if (!hierarchy) { res.status(404).json({ error: 'Series or its episode hierarchy is unavailable' }); return; }
  res.status(200).json(hierarchy);
}
