export type JhadinaWorldId =
  | "home" | "assistant" | "work" | "activity" | "memory" | "health" | "growth" | "calendar"
  | "music" | "tv" | "studio" | "social" | "pupsonstuff" | "trucker"
  | "cooking" | "shopping" | "radar" | "knowledge" | "money" | "wallet"
  | "opportunities" | "spatial" | "publishing" | "campaign" | "placement"
  | "sports" | "safety" | "overage" | "homebase" | "pod";

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
  href?: string;
  access: "native" | "assistant";
  group: "core" | "work" | "media" | "intelligence" | "business";
}

const sharedInputs = ["memory", "preferences", "context", "awareness", "activity", "permissions"];
const sharedOutputs = ["recommendations", "actions", "reminders", "timeline", "audit"];

type WorldRow = {
  id: JhadinaWorldId;
  label: string;
  description: string;
  capabilities: string[];
  inputs: string[];
  href?: string;
  group: JhadinaWorldDefinition["group"];
};

const worldRows: WorldRow[] = [
  { id:"home", label:"Home", description:"Attention, continuity and recent governed work", capabilities:["recommendations","awareness"], inputs:["discover","coordinate"], href:"/", group:"core" },
  { id:"assistant", label:"Ask Jhadina", description:"Governed LLM and Intelligence Router surface", capabilities:["reason","propose","explain"], inputs:["memory","activity","spatial"], href:"/ask-jhadina", group:"core" },
  { id:"work", label:"Work", description:"Cross-subsystem workspaces and execution surfaces", capabilities:["open","continue","review"], inputs:["projects","activity"], href:"/work", group:"core" },
  { id:"activity", label:"Activity", description:"Unified governed audit and action timeline", capabilities:["timeline","audit"], inputs:["all-worlds"], href:"/activity", group:"core" },
  { id:"memory", label:"Memory", description:"Approved memories and pending memory decisions", capabilities:["review","search"], inputs:["memory"], href:"/memory", group:"core" },
  { id:"health", label:"System status", description:"Evidence-backed runtime status only", capabilities:["inspect"], inputs:["activity","runtime"], href:"/health", group:"core" },

  { id:"money", label:"Money", description:"Financial awareness, accounts and governed decisions", capabilities:["accounts","review","operations"], inputs:["transactions","goals"], href:"/money/command-center", group:"intelligence" },
  { id:"wallet", label:"Wallet / SHARK", description:"Wallet and market intelligence surfaces", capabilities:["wallet","intelligence"], inputs:["market","wallet"], href:"/wallet", group:"intelligence" },
  { id:"spatial", label:"Spatial / God’s Eye View", description:"Evidence-backed live world context", capabilities:["observe","inspect","compare","replay"], inputs:["location","evidence","source-health"], href:"/spatial", group:"intelligence" },
  { id:"knowledge", label:"Knowledge", description:"Research, evidence, provenance and governed knowledge admission", capabilities:["search","research","provenance"], inputs:["evidence","memory"], group:"intelligence" },
  { id:"sports", label:"Sports Intelligence", description:"Perception, simulation and coach-facing win-path intelligence", capabilities:["observe","simulate","explain"], inputs:["games","evidence"], group:"intelligence" },
  { id:"safety", label:"SafetyOS", description:"Personal safety runtime, drills and governed escalation evidence", capabilities:["monitor","drill","evidence"], inputs:["safety","spatial"], group:"intelligence" },
  { id:"homebase", label:"Homebase", description:"Connectivity, offline knowledge, mesh and remote-compute coordination", capabilities:["connectivity","offline","mesh"], inputs:["network","knowledge","devices"], group:"intelligence" },

  { id:"studio", label:"Director Workstation", description:"Creative editing and generated-asset workstation", capabilities:["projects","assets","timeline"], inputs:["projects","media"], href:"/workstation", group:"work" },
  { id:"growth", label:"Growth", description:"Draft, approval and scheduling workflow", capabilities:["draft","approve","schedule"], inputs:["content","activity"], href:"/growth", group:"work" },
  { id:"opportunities", label:"Opportunities", description:"Find, qualify and authorize research on opportunities", capabilities:["discover","qualify","track"], inputs:["research","money"], href:"/opportunity", group:"work" },
  { id:"campaign", label:"CampaignOS", description:"Campaign intelligence and polling surfaces", capabilities:["polls","research"], inputs:["polling","knowledge"], href:"/campaign/polls", group:"work" },
  { id:"placement", label:"PlacementOS", description:"Worker, agency and employer placement workflows", capabilities:["opportunities","offers","jobs"], inputs:["jobs","people"], href:"/placement/worker/opportunities", group:"work" },
  { id:"calendar", label:"Calendar", description:"Schedule and time-aware coordination", capabilities:["schedule","review"], inputs:["time","work"], href:"/calendar", group:"work" },
  { id:"overage", label:"OverageOS", description:"Unclaimed-property discovery and recovery operations", capabilities:["discover","cases","recovery"], inputs:["public-records","opportunities"], group:"work" },
  { id:"evolution", label:"Evolution / Coding", description:"Governed code-change proposals, verification and repository work", capabilities:["propose","verify","code"], inputs:["repository","policy","activity"], group:"work" },
  { id:"staffing", label:"Staffing / Subcontracting", description:"Staffing, placement and subcontractor operations", capabilities:["staff","match","contracts"], inputs:["people","opportunities"], group:"work" },

  { id:"music", label:"Music", description:"Listen, discover and manage music", capabilities:["search","recommendations","playback"], inputs:["music","activity"], href:"/music", group:"media" },
  { id:"tv", label:"JhadinaTV", description:"Watch and discover visual media", capabilities:["search","recommendations","watchlist"], inputs:["media","activity"], href:"/jhadinatv", group:"media" },
  { id:"publishing", label:"Publishing", description:"Books, ebooks, digital files and print-on-demand", capabilities:["write","format","proof","catalog"], inputs:["studio","knowledge","commerce"], group:"media" },
  { id:"social", label:"Social", description:"Social discovery, review and governed publishing", capabilities:["draft","schedule","review"], inputs:["content","activity"], href:"/social", group:"media" },

  { id:"pupsonstuff", label:"PupsonStuff", description:"Pet products, creative generation and commerce", capabilities:["products","creative","orders"], inputs:["shopping","commerce"], group:"business" },
  { id:"pod", label:"AI POD Shop", description:"Generalized AI print-on-demand creation, product studio and fulfillment", capabilities:["generate","products","fulfillment"], inputs:["creative","commerce"], group:"business" },
  { id:"homebase", label:"Homebase", description:"Connectivity, local compute, cloud/offline continuity and device support", capabilities:["connectivity","compute","continuity"], inputs:["network","device","cloud"], group:"business" },
  { id:"pod", label:"AI POD Studio", description:"Generalized AI product design, 3D product studio and print-on-demand workflow", capabilities:["generate","customize","products"], inputs:["creative","commerce"], group:"business" },
  { id:"shopping", label:"Shopping", description:"Universal product discovery and purchasing", capabilities:["search","watchlist","compare","cart"], inputs:["products","prices","orders"], group:"business" },
  { id:"trucker", label:"TruckerOS", description:"Driving, work and trip intelligence", capabilities:["loads","trips","profit"], inputs:["money","travel"], group:"business" },
  { id:"cooking", label:"Cooking", description:"Recipes, ingredients and drinks", capabilities:["recipes","recommendations","timers"], inputs:["food","shopping"], group:"business" },
  { id:"radar", label:"Radar", description:"Live things worth noticing", capabilities:["local","events","alerts"], inputs:["location","interests"], group:"business" },
];

export const JHADINA_WORLDS: JhadinaWorldDefinition[] = worldRows.map((world) => ({
  id: world.id,
  label: world.label,
  description: world.description,
  href: world.href,
  access: world.href ? "native" : "assistant",
  group: world.group,
  capabilities: world.capabilities.map((capability) => ({ id: capability, label: capability, enabled: true })),
  intelligenceInputs: [...sharedInputs, ...world.inputs],
  intelligenceOutputs: sharedOutputs,
}));

export function getWorld(id: JhadinaWorldId) {
  return JHADINA_WORLDS.find((world) => world.id === id);
}

export function worldAssistantHref(world: JhadinaWorldDefinition) {
  return "/ask-jhadina?surface=" + encodeURIComponent(world.id) + "&route=" + encodeURIComponent(world.href ?? "/worlds");
}
