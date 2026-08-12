export type JhadinaWorldId =
  | "home" | "music" | "tv" | "studio" | "social" | "pupsonstuff"
  | "trucker" | "cooking" | "shopping" | "radar" | "knowledge"
  | "money" | "opportunities" | "activity" | "publishing";

export interface WorldCapability {
  id: string;
  label: string;
  enabled: boolean;
}

export interface JhadinaWorldDefinition {
  id: JhadinaWorldId;
  label: string;
  description: string;
  capabilities: WorldCapability[];
  intelligenceInputs: string[];
  intelligenceOutputs: string[];
}

const sharedInputs = ["memory", "preferences", "context", "awareness", "activity", "permissions"];
const sharedOutputs = ["recommendations", "actions", "reminders", "timeline", "audit"];

export const JHADINA_WORLDS: JhadinaWorldDefinition[] = [
  ["home", "Home", "Personal command surface", ["recommendations", "awareness"], ["discover", "coordinate"]],
  ["music", "Music", "Listen, discover and manage music", ["search", "recommendations", "playback"], ["music", "activity"]],
  ["tv", "JhadinaTV", "Watch and discover visual media", ["search", "recommendations", "watchlist"], ["media", "activity"]],
  ["studio", "Studio", "Create and manage creative work", ["projects", "assets", "workflow"], ["projects", "activity"]],
  ["social", "Social", "Social discovery and publishing", ["draft", "schedule", "review"], ["content", "activity"]],
  ["pupsonstuff", "PupsonStuff", "Pet products and commerce", ["products", "campaigns", "orders"], ["shopping", "revenue"]],
  ["trucker", "TruckerOS", "Driving, work and trip intelligence", ["loads", "trips", "profit"], ["money", "travel"]],
  ["cooking", "Cooking", "Recipes, ingredients and drinks", ["recipes", "recommendations", "timers"], ["food", "shopping"]],
  ["shopping", "Shopping", "Universal product discovery and purchasing", ["search", "watchlist", "compare", "cart"], ["products", "prices", "orders"]],
  ["radar", "Radar", "Live things worth noticing", ["local", "events", "alerts"], ["location", "interests"]],
  ["knowledge", "Knowledge", "Research, memory and digests", ["search", "digest", "provenance"], ["evidence", "memory"]],
  ["money", "Money", "Financial awareness and decisions", ["accounts", "budgets", "opportunities"], ["transactions", "goals"]],
  ["opportunities", "Opportunities", "Find and qualify opportunities", ["discover", "qualify", "track"], ["research", "money"]],
  ["activity", "Activity", "Unified audit and action timeline", ["timeline", "audit", "undo"], ["all-worlds"]],
  ["publishing", "Publishing", "Books, ebooks, digital files and print-on-demand", ["write", "format", "cover", "proof", "pod", "digital-sales", "ebook-sales", "catalog", "orders", "analytics"], ["studio", "knowledge", "commerce", "money", "activity"]],
].map(([id, label, description, capabilities, inputs]) => ({
  id: id as JhadinaWorldId,
  label,
  description,
  capabilities: capabilities.map((capability) => ({ id: capability, label: capability, enabled: true })),
  intelligenceInputs: [...sharedInputs, ...inputs],
  intelligenceOutputs: sharedOutputs,
}));

export function getWorld(id: JhadinaWorldId) {
  return JHADINA_WORLDS.find((world) => world.id === id);
}
