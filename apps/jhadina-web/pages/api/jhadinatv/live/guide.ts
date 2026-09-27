import type { NextApiRequest, NextApiResponse } from 'next';
import { buildUnifiedGuide, type LiveProgram } from '@jhadina/tv-core';
import { getJellyfinAdmissionStatus } from '../../../../lib/jhadinatv/jellyfin-provider';
import { jhadinaTVLiveProvider } from '../../../../lib/jhadinatv/server-catalog';

function queryString(value: string | string[] | undefined): string | undefined {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim() || undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const status = getJellyfinAdmissionStatus();
  const provider = jhadinaTVLiveProvider;
  if (!provider || !status.admitted) return res.status(503).json({ error: 'No admitted Live TV provider is configured.', status });

  const now = new Date();
  const from = queryString(req.query.from) ?? new Date(now.getTime() - 30 * 60_000).toISOString();
  const to = queryString(req.query.to) ?? new Date(now.getTime() + 6 * 60 * 60_000).toISOString();

  try {
    const channels = await provider.listChannels();
    let programs: LiveProgram[] = [];
    if (provider.getProgramsForChannels) {
      programs = await provider.getProgramsForChannels(channels.map((channel) => channel.id), from, to);
    } else if (provider.getPrograms) {
      programs = (await Promise.all(channels.map((channel) => provider.getPrograms!(channel.id, from, to)))).flat();
    }
    res.status(200).json({
      provider: { id: provider.id, name: provider.name },
      generatedAt: now.toISOString(),
      from,
      to,
      guide: buildUnifiedGuide(channels, programs, now),
    });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : 'Live TV guide failed.' });
  }
}
