import type { NextApiRequest, NextApiResponse } from 'next';
import { requireJtvOwner } from '../../../../lib/jhadinatv/server-viewer';
import { getJellyfinAdmissionStatus } from '../../../../lib/jhadinatv/jellyfin-provider';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!(await requireJtvOwner(req, res))) return;
  res.status(200).json({ providers: [getJellyfinAdmissionStatus()] });
}
