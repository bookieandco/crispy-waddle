export type StoryElementKind = "character" | "location" | "event" | "world-rule" | "scene" | "dialogue";
export type StoryProvenance = "fictional" | "verified" | "derived" | "alternate-history";

export interface StoryElement {
  id: string;
  kind: StoryElementKind;
  title: string;
  content: string;
  provenance: StoryProvenance;
  sourceIds: string[];
  canon: boolean;
}

export interface StoryBible {
  id: string;
  title: string;
  genre?: string;
  tone?: string;
  elements: StoryElement[];
  continuityNotes: string[];
}

export function createStoryBible(title: string, options: Pick<StoryBible, "genre" | "tone"> = {}): StoryBible {
  return { id: crypto.randomUUID(), title, genre: options.genre, tone: options.tone, elements: [], continuityNotes: [] };
}

export function addStoryElement(bible: StoryBible, element: Omit<StoryElement, "id">): StoryBible {
  return { ...bible, elements: [...bible.elements, { ...element, id: crypto.randomUUID() }] };
}

export function verifyStoryElementSources(bible: StoryBible, verifiedSourceIds: Set<string>): StoryBible {
  return {
    ...bible,
    elements: bible.elements.map((element) => {
      if (element.provenance !== "verified" || element.sourceIds.length === 0) return element;
      const verified = element.sourceIds.every((id) => verifiedSourceIds.has(id));
      return verified ? element : { ...element, provenance: "derived" };
    }),
  };
}
