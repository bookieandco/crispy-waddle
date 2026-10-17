import type { NextApiRequest, NextApiResponse } from 'next';
import { requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';
import { getAuthorizedJellyfinTitle } from '../../../lib/jhadinatv/jellyfin-provider';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!(await requireJtvOwner(req, res))) return;
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const kind = req.query.kind;
  if (!/^jellyfin(?:-live)?:[A-Za-z0-9._:-]{1,160}$/.test(id) || (kind !== 'movie' && kind !== 'tv')) {
    res.status(400).json({ error: 'Invalid media identity' }); return;
  }
  const title = await getAuthorizedJellyfinTitle(id, kind);
  if (!title) { res.status(404).json({ error: 'Title is not available to this library' }); return; }
  res.status(200).json({ title });
}
