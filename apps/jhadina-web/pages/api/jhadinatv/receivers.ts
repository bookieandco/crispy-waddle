import type { NextApiRequest, NextApiResponse } from 'next';

type Receiver = { id: string; name: string; url: string };

export default function handler(_req: NextApiRequest, res: NextApiResponse<Receiver[] | { error: string }>) {
  try {
    const raw = process.env.JHADINA_TV_RECEIVERS ?? '[]';
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('JHADINA_TV_RECEIVERS must be a JSON array.');
    const receivers = parsed.filter((item): item is Receiver => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.url === 'string' && /^wss?:\/\//.test(value.url);
    });
    res.status(200).json(receivers);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Invalid receiver configuration.' });
  }
}
