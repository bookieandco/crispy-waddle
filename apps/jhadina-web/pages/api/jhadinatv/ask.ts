import type { NextApiRequest, NextApiResponse } from 'next';
import { jhadinaTVServerRuntime } from '../../../lib/jhadinatv/server-catalog';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const [recommendations, catalog] = await Promise.all([jhadinaTVServerRuntime.ask(query), jhadinaTVServerRuntime.search('')]);
  const byId = new Map(catalog.map((title) => [title.id, title]));
  res.status(200).json({ recommendations, titles: recommendations.map((item) => byId.get(item.titleId)).filter(Boolean) });
}
