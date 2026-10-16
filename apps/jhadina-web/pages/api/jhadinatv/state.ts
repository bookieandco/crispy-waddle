import type { NextApiRequest, NextApiResponse } from 'next';
import { createJtvOwnerClient, requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';

const ID = /^jellyfin(?:-live)?:[A-Za-z0-9._:-]{1,160}$/;
function stringId(value: unknown): string {
  return typeof value === 'string' && ID.test(value) ? value : '';
}
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST'); res.status(405).json({ error: 'Method not allowed' }); return;
  }
  const ownerId = await requireJtvOwner(req, res);
  if (!ownerId) return;
  const db = createJtvOwnerClient(req, res);
  if (req.method === 'GET') {
    const mediaId = stringId(req.query.mediaId);
    if (req.query.mediaId && !mediaId) { res.status(400).json({ error: 'Invalid media identity' }); return; }
    try {
      if (mediaId) {
        const [checkpoint, watchlisted] = await Promise.all([
          db.from('jtv_playback_checkpoints').select('media_id,position_seconds,duration_seconds,completed,observed_at').eq('user_id', ownerId).eq('media_id', mediaId).maybeSingle(),
          db.from('jtv_watchlist').select('media_id').eq('user_id', ownerId).eq('media_id', mediaId).maybeSingle(),
        ]);
        if (checkpoint.error || watchlisted.error) throw new Error('JTV storage not commissioned');
        res.status(200).json({ checkpoint: checkpoint.data, watchlisted: Boolean(watchlisted.data) }); return;
      }
      const [resume, watchlist] = await Promise.all([
        db.from('jtv_playback_checkpoints').select('media_id,position_seconds,duration_seconds,completed,observed_at').eq('user_id', ownerId).eq('completed', false).order('observed_at', { ascending: false }).limit(50),
        db.from('jtv_watchlist').select('media_id,added_at').eq('user_id', ownerId).order('added_at', { ascending: false }).limit(100),
      ]);
      if (resume.error || watchlist.error) throw new Error('JTV storage not commissioned');
      res.status(200).json({ continueWatching: resume.data, watchlist: watchlist.data }); return;
    } catch { res.status(503).json({ error: 'Private viewing history is not commissioned.' }); return; }
  }
  const body = req.body as { action?: unknown; mediaId?: unknown; positionSeconds?: unknown;
    durationSeconds?: unknown; observedAt?: unknown; enabled?: unknown } | null;
  const mediaId = stringId(body?.mediaId);
  if (!mediaId || !body || (body.action !== 'checkpoint' && body.action !== 'watchlist')) {
    res.status(400).json({ error: 'Invalid viewing state request' }); return;
  }
  try {
    if (body.action === 'watchlist') {
      if (typeof body.enabled !== 'boolean') { res.status(400).json({ error: 'Invalid watchlist setting' }); return; }
      const result = body.enabled
        ? await db.from('jtv_watchlist').upsert({ user_id: ownerId, media_id: mediaId }, { onConflict: 'user_id,media_id' })
        : await db.from('jtv_watchlist').delete().eq('user_id', ownerId).eq('media_id', mediaId);
      if (result.error) throw result.error;
    } else {
      const position = body.positionSeconds;
      const duration = body.durationSeconds == null ? null : body.durationSeconds;
      const observed = typeof body.observedAt === 'string' ? new Date(body.observedAt) : null;
      if (typeof position !== 'number' || !Number.isFinite(position) || position < 0 || position >= 10000000 ||
          (duration !== null && (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration >= 10000000)) ||
          !observed || Number.isNaN(observed.getTime()) || observed.getTime() > Date.now() + 120000 ||
          observed.getTime() < Date.now() - 30 * 86400000) {
        res.status(400).json({ error: 'Invalid playback checkpoint' }); return;
      }
      const result = await db.rpc('jtv_record_checkpoint', {
        p_media_id: mediaId, p_position_seconds: position,
        p_duration_seconds: duration, p_observed_at: observed.toISOString(),
      });
      if (result.error) throw result.error;
    }
    res.status(200).json({ saved: true });
  } catch { res.status(503).json({ error: 'Private viewing state storage is unavailable.' }); }
}
