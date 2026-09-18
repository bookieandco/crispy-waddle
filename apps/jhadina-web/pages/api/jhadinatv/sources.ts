import type { NextApiRequest, NextApiResponse } from 'next';
import { jhadinaTVServerRegistry } from '../../../../lib/jhadinatv/server-catalog';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = typeof req.query.provider === 'string' ? req.query.provider : '';
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  try { res.status(200).json({ sources: await jhadinaTVServerRegistry.resolveSources(provider, id) }); }
  catch (cause) { res.status(404).json({ error: cause instanceof Error ? cause.message : 'Source resolution failed' }); }
}
