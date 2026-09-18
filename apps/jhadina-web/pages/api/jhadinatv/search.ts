import type { NextApiRequest, NextApiResponse } from 'next';
import { jhadinaTVServerRuntime } from '../../../lib/jhadinatv/server-catalog';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.status(200).json({ titles: await jhadinaTVServerRuntime.search(query) });
}
