import type { NextApiRequest, NextApiResponse } from 'next';
import { createJtvOwnerClient, requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';
import { jhadinaTVServerRegistry } from '../../../lib/jhadinatv/server-catalog';
import { createDeterministicMediaAdvisor, createJhadinaTVRuntime, type ViewingSignal } from '@jhadina/tv-core';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<NextApiResponse | void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const owner = await requireJtvOwner(req, res);
  if (!owner) return;
  const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 180) : '';
  let personalization: 'operational-history' | 'unavailable' = 'unavailable';
  let signals: ViewingSignal[] = [];
  try {
    const db = createJtvOwnerClient(req, res);
    const { data, error } = await db.from('jtv_playback_checkpoints')
      .select('media_id,position_seconds,completed,observed_at').eq('user_id', owner)
      .order('observed_at', { ascending: false }).limit(100);
    if (!error && data) {
      signals = data.map(row => ({
        titleId: row.media_id, completed: Boolean(row.completed),
        progressMinutes: (row.position_seconds ?? 0) / 60,
        observedAt: row.observed_at, kind: 'observed-behavior' as const,
        source: 'jtv-operational-checkpoint',
      }));
      personalization = 'operational-history';
    }
  } catch { /* Repository may deploy before RLS schema is commissioned. */ }
  const runtime = createJhadinaTVRuntime(jhadinaTVServerRegistry, createDeterministicMediaAdvisor(), {
    getViewingSignals: async () => signals,
    getMediaKnowledge: async () => [], // Evidence-backed scene knowledge requires separate approval.
  });
  try {
    const [recommendations, catalog] = await Promise.all([runtime.ask(query), runtime.search('')]);
    const byId = new Map(catalog.map(title => [title.id, title]));
    return res.status(200).json({ recommendations,
      titles: recommendations.map(item => byId.get(item.titleId)).filter(Boolean), personalization });
  } catch { return res.status(503).json({ error: 'Admitted media catalog is unavailable.', personalization }); }
}
