export type JhadinaSurface = 'home' | 'director' | 'growth' | 'music' | 'opportunities' | 'knowledge' | 'money' | 'shopping' | 'cooking' | 'settings' | 'unknown';
export type JhadinaCommand = { id: string; text: string; source: 'button' | 'voice' | 'keyboard' | 'system'; surface: JhadinaSurface; context?: Record<string, unknown>; createdAt: string };
export type JhadinaResult = { status: 'completed' | 'needs_approval' | 'rejected' | 'failed'; message: string; data?: unknown };
export type JhadinaHandler = (command: JhadinaCommand) => Promise<JhadinaResult>;
const handlers = new Map<string, JhadinaHandler>();
export function registerJhadinaCapability(name: string, handler: JhadinaHandler) { handlers.set(name, handler); return () => handlers.delete(name); }
export async function dispatchJhadinaCommand(command: JhadinaCommand): Promise<JhadinaResult> {
  const capability = resolveCapability(command.text, command.surface);
  const handler = handlers.get(capability);
  if (!handler) return { status: 'needs_approval', message: `I understand the request, but the ${capability} capability is not connected yet.` };
  return handler(command);
}
function resolveCapability(text: string, surface: JhadinaSurface): string {
  const value = text.toLowerCase();
  if (/\b(short|reel|tiktok|clip|video|scene|faceless|director)\b/.test(value)) return 'director';
  if (/\b(buy|order|purchase|flowers|toilet paper|shopping)\b/.test(value)) return 'shopping';
  if (/\b(recipe|cook|cooking|timer|bake|boil|simmer)\b/.test(value)) return 'cooking';
  if (/\b(digest|pdf|document|learn|summarize|save this)\b/.test(value)) return 'knowledge';
  if (/\b(post|publish|social|instagram|youtube|tiktok|reel)\b/.test(value)) return 'growth';
  if (/\b(play|song|music|album|playlist|artist)\b/.test(value) || surface === 'music') return 'music';
  if (/\b(movie|show|watch|episode|film|trailer)\b/.test(value) || surface === 'director') return 'watch';
  if (/\b(remind|reminder|remember|notify|alert)\b/.test(value)) return 'awareness';
  if (/\b(find|search|look up|what is|who is)\b/.test(value)) return 'research';
  return 'general';
}
