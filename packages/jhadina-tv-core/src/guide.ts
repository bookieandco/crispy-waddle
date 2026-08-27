import type { LiveChannel, LiveProgram } from './live-tv';

export interface UnifiedGuideRow {
  channel: LiveChannel;
  program?: LiveProgram;
}

export function getCurrentProgram(programs: LiveProgram[], now = new Date()): LiveProgram | undefined {
  const timestamp = now.getTime();
  return programs.find((program) => {
    const start = Date.parse(program.startTime);
    const end = Date.parse(program.endTime);
    return Number.isFinite(start) && Number.isFinite(end) && start <= timestamp && timestamp < end;
  });
}

export function buildUnifiedGuide(channels: LiveChannel[], programs: LiveProgram[], now = new Date()): UnifiedGuideRow[] {
  return channels.map((channel) => ({ channel, program: getCurrentProgram(programs.filter((item) => item.channelId === channel.id), now) }));
}
