import type { JhadinaBrand } from "./types.js";

export interface SocialCharacterProfile {
  id: string;
  brand: JhadinaBrand;
  label: string;
  aliases: readonly string[];
  description: string;
  toneTraits: readonly string[];
  pointOfView: string;
  voiceProfileRef: string;
  /** Optional acoustic identity. Brand/expression voice does not imply a speaker. */
  speakerIdentityRef?: string;
  evidenceRefs: readonly string[];
  status: "active" | "paused";
  authority: "EXPRESSION_ONLY";
}

const PROFILES: readonly SocialCharacterProfile[] = [
  {
    id: "character:jhadina",
    brand: "jhadina",
    label: "Jhadina",
    aliases: ["jhadina", "main jhadina", "jhadina personality", "jhadina character"],
    description: "Main Jhadina public-facing brand character.",
    toneTraits: ["direct", "intelligent", "evidence-aware", "adaptive"],
    pointOfView: "Make complex systems useful, explainable, and governed.",
    voiceProfileRef: "brand-voice:jhadina",
    speakerIdentityRef: "voice:jhadina:canonical:v1",
    evidenceRefs: ["brand:jhadina", "voice-profile:jhadina"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:jhadinatv",
    brand: "jhadinatv",
    label: "JhadinaTV",
    aliases: ["jhadinatv", "jhadina tv", "jhadina tv personality", "jhadinatv personality"],
    description: "Entertainment and visual-media publishing character.",
    toneTraits: ["cinematic", "curious", "entertaining", "visual"],
    pointOfView: "Help audiences discover and understand visual media through distinctive presentation.",
    voiceProfileRef: "brand-voice:jhadinatv",
    speakerIdentityRef: "voice:jhadina:canonical:v1",
    evidenceRefs: ["brand:jhadinatv", "voice-profile:jhadinatv"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:jhadina-music",
    brand: "jhadina-music",
    label: "Jhadina Music",
    aliases: ["jhadina music", "music personality", "jhadina music personality"],
    description: "Music discovery, culture, and artist-facing character.",
    toneTraits: ["music-native", "curious", "cultural", "energetic"],
    pointOfView: "Treat music as culture, discovery, craft, and audience connection.",
    voiceProfileRef: "brand-voice:jhadina-music",
    speakerIdentityRef: "voice:jhadina:canonical:v1",
    evidenceRefs: ["brand:jhadina-music", "voice-profile:jhadina-music"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:bookieandco",
    brand: "bookieandco",
    label: "Bookie & Co.",
    aliases: ["bookie and co", "bookie & co", "bookieandco", "bookie personality"],
    description: "Bookie & Co. company/portfolio character.",
    toneTraits: ["business-minded", "direct", "resourceful", "practical"],
    pointOfView: "Turn ideas into useful products, systems, and businesses with measurable outcomes.",
    voiceProfileRef: "brand-voice:bookieandco",
    evidenceRefs: ["brand:bookieandco", "voice-profile:bookieandco"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:pupsonstuff",
    brand: "pupsonstuff",
    label: "PupsonStuff",
    aliases: ["pupsonstuff", "pupson stuff", "pupsonstuff personality", "pup personality"],
    description: "Pet-product and personalized-gift character.",
    toneTraits: ["playful", "warm", "visual", "pet-friendly"],
    pointOfView: "Turn a real pet's identity into delightful personalized products without losing what makes the pet recognizable.",
    voiceProfileRef: "brand-voice:pupsonstuff",
    evidenceRefs: ["brand:pupsonstuff", "voice-profile:pupsonstuff"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:atwood-bookie",
    brand: "atwood-bookie",
    label: "Atwood Bookie",
    aliases: ["atwood bookie", "atwood", "atwood bookie personality", "artist personality"],
    description: "Artist/music audience character.",
    toneTraits: ["bold", "cultural", "irreverent", "distinctive"],
    pointOfView: "Build a recognizable music identity through culture, sound, visual language, and audience connection.",
    voiceProfileRef: "brand-voice:atwood-bookie",
    evidenceRefs: ["brand:atwood-bookie", "voice-profile:atwood-bookie"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:truckeros",
    brand: "truckeros",
    label: "Truckeros",
    aliases: ["truckeros", "truckeros personality", "trucking profile", "truck driver profile"],
    description: "Trucking-industry social character for drivers, owner-operators, fleets, freight, and adjacent commercial opportunities.",
    toneTraits: ["direct", "industry-native", "useful", "sharp", "practical"],
    pointOfView: "Respect drivers' time, speak plainly, surface useful opportunities, and avoid corporate fluff.",
    voiceProfileRef: "brand-voice:truckeros",
    evidenceRefs: ["brand:truckeros", "voice-profile:truckeros"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
  {
    id: "character:overageos",
    brand: "overageos",
    label: "OverageOS",
    aliases: ["overageos", "overage os", "overage personality", "overageos personality"],
    description: "Surplus-funds and recovery-information character.",
    toneTraits: ["clear", "trustworthy", "helpful", "evidence-first"],
    pointOfView: "Explain recovery opportunities accurately, transparently, and with verifiable jurisdiction-specific evidence.",
    voiceProfileRef: "brand-voice:overageos",
    evidenceRefs: ["brand:overageos", "voice-profile:overageos"],
    status: "active",
    authority: "EXPRESSION_ONLY",
  },
];

export function listSocialCharacterProfiles(): SocialCharacterProfile[] {
  return PROFILES.map(cloneProfile);
}

export function getSocialCharacterProfile(id: string): SocialCharacterProfile | undefined {
  const found = PROFILES.find((profile) => profile.id === id);
  return found ? cloneProfile(found) : undefined;
}

export function getSocialCharacterProfileForBrand(
  brand: JhadinaBrand,
): SocialCharacterProfile | undefined {
  const found = PROFILES.find((profile) => profile.brand === brand && profile.status === "active");
  return found ? cloneProfile(found) : undefined;
}

export function resolveSocialCharacterProfiles(text: string): SocialCharacterProfile[] {
  const normalized = normalize(text);
  if (!normalized) return [];

  const scored = PROFILES
    .filter((profile) => profile.status === "active")
    .map((profile) => {
      const aliases = [profile.label, profile.brand, ...profile.aliases];
      const matched = aliases.filter((alias) => normalized.includes(normalize(alias)));
      const score = matched.reduce((best, alias) => Math.max(best, normalize(alias).length), 0);
      return { profile, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id));

  if (!scored.length) return [];
  const max = scored[0]!.score;
  return scored.filter((entry) => entry.score === max).map((entry) => cloneProfile(entry.profile));
}

export function createVentureSocialCharacterProfile(input: {
  ventureRef: string;
  label: string;
  toneTraits: readonly string[];
  pointOfView: string;
  voiceProfileRef: string;
  aliases?: readonly string[];
  evidenceRefs: readonly string[];
  speakerIdentityRef?: string;
}): SocialCharacterProfile {
  const ventureRef = input.ventureRef.trim().replace(/^venture:/i, "");
  if (!ventureRef) throw new Error("SOCIAL_VENTURE_CHARACTER_REF_REQUIRED");
  if (!input.label.trim()) throw new Error("SOCIAL_VENTURE_CHARACTER_LABEL_REQUIRED");
  if (!input.toneTraits.length || input.toneTraits.some((trait) => !trait.trim())) {
    throw new Error("SOCIAL_VENTURE_CHARACTER_TONE_REQUIRED");
  }
  if (!input.pointOfView.trim()) throw new Error("SOCIAL_VENTURE_CHARACTER_POV_REQUIRED");
  if (!input.voiceProfileRef.trim()) throw new Error("SOCIAL_VENTURE_CHARACTER_VOICE_REQUIRED");
  if (!input.evidenceRefs.length) throw new Error("SOCIAL_VENTURE_CHARACTER_EVIDENCE_REQUIRED");
  if (input.speakerIdentityRef !== undefined && !input.speakerIdentityRef.trim()) {
    throw new Error("SOCIAL_VENTURE_CHARACTER_SPEAKER_INVALID");
  }

  const brand = `venture:${ventureRef.replace(/[^0-9A-Za-z:_-]+/g, "-")}` as JhadinaBrand;
  return Object.freeze({
    id: `character:${brand}`,
    brand,
    label: input.label.trim(),
    aliases: Object.freeze([
      input.label.trim(),
      brand,
      ...(input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
    ]),
    description: `Business Factory venture social character for ${input.label.trim()}.`,
    toneTraits: Object.freeze(input.toneTraits.map((trait) => trait.trim())),
    pointOfView: input.pointOfView.trim(),
    voiceProfileRef: input.voiceProfileRef.trim(),
    speakerIdentityRef: input.speakerIdentityRef?.trim(),
    evidenceRefs: Object.freeze([...new Set(input.evidenceRefs.map((ref) => ref.trim()).filter(Boolean))]),
    status: "active",
    authority: "EXPRESSION_ONLY",
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cloneProfile(profile: SocialCharacterProfile): SocialCharacterProfile {
  return {
    ...profile,
    aliases: [...profile.aliases],
    toneTraits: [...profile.toneTraits],
    evidenceRefs: [...profile.evidenceRefs],
  };
}
