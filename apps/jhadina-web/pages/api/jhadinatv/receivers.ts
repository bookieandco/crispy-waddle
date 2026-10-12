import type { NextApiRequest, NextApiResponse } from 'next';
import { createJtvReceiverToken } from '../../../lib/jhadinatv/receiver-capability';
import { requireJtvOwner } from '../../../lib/jhadinatv/server-viewer';

type Receiver = { id: string; name: string; url: string; authToken: string };
type ReceiverConfig = Pick<Receiver, 'id' | 'name' | 'url'>;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Receiver[] | { error: string }>) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const ownerId = await requireJtvOwner(req, res);
  if (!ownerId) return;

  // The browser must never discover an uncertified, unauthenticated receiver.
  if (process.env.JHADINA_TV_RECEIVER_PAIRING_VERIFIED !== 'true') return res.status(200).json([]);
  const secret = process.env.JHADINA_TV_RECEIVER_SIGNING_SECRET ?? '';
  if (Buffer.byteLength(secret) < 32) return res.status(503).json({ error: 'Secure receiver pairing is not commissioned.' });

  try {
    const parsed = JSON.parse(process.env.JHADINA_TV_RECEIVERS ?? '[]') as unknown;
    if (!Array.isArray(parsed)) throw new Error('Invalid receiver registry.');
    const allowed = new Set((process.env.JHADINA_TV_RECEIVER_APPROVED_IDS ?? '').split(',').map(v => v.trim()).filter(Boolean));
    const receivers: Receiver[] = [];
    for (const input of parsed) {
      if (!input || typeof input !== 'object') continue;
      const row = input as Partial<ReceiverConfig>;
      if (typeof row.id !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(row.id) ||
          typeof row.name !== 'string' || !row.name.trim() ||
          typeof row.url !== 'string' || !allowed.has(row.id)) continue;
      let url: URL;
      try { url = new URL(row.url); } catch { continue; }
      if (url.protocol !== 'wss:' || url.username || url.password || url.hash || url.search) continue;
      receivers.push({ id: row.id, name: row.name, url: url.toString(),
        authToken: createJtvReceiverToken(ownerId, row.id, secret) });
    }
    return res.status(200).json(receivers);
  } catch {
    return res.status(503).json({ error: 'Secure receiver registry is invalid.' });
  }
}
