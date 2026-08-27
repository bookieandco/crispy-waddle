export interface TasteSignal { subject: string; category: string; sentiment: number; confidence: number; sourceExperienceIds: string[]; }

export interface TasteProfile { version: 1; signals: readonly TasteSignal[]; }

export interface TasteObservation { subject: string; category: string; sentiment: number; experienceId: string; }

const clamp = (value: number) => Math.max(-100, Math.min(100, value));

export function aggregateTaste(observations: readonly TasteObservation[]): TasteProfile {
  const groups = new Map<string, TasteObservation[]>();
  for (const observation of observations) {
    const key = `${observation.category}:${observation.subject}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const signals: TasteSignal[] = [];
  for (const group of groups.values()) {
    const sentiment = clamp(group.reduce((sum, item) => sum + item.sentiment, 0) / group.length);
    const confidence = Math.min(100, 35 + group.length * 10 + (new Set(group.map((item) => item.experienceId)).size - 1) * 5);
    signals.push({
      subject: group[0].subject,
      category: group[0].category,
      sentiment,
      confidence,
      sourceExperienceIds: [...new Set(group.map((item) => item.experienceId))],
    });
  }
  return { version: 1, signals };
}
