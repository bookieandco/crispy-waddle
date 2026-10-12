import type { NextApiRequest, NextApiResponse } from 'next';
import { requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';
import { jhadinaTVServerRuntime } from '../../../lib/jhadinatv/server-catalog';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<NextApiResponse | void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!(await requireJtvOwner(req, res))) return;
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const [recommendations, catalog] = await Promise.all([jhadinaTVServerRuntime.ask(query), jhadinaTVServerRuntime.search('')]);
  const byId = new Map(catalog.map((title) => [title.id, title]));
  res.status(200).json({ recommendations, titles: recommendations.map((item) => byId.get(item.titleId)).filter(Boolean) });
}
