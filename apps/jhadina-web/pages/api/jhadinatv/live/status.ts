import type { NextApiRequest, NextApiResponse } from 'next';
import { getJellyfinAdmissionStatus } from '../../../../lib/jhadinatv/jellyfin-provider';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ providers: [getJellyfinAdmissionStatus()] });
}
