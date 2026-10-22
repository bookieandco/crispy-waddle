/** JLLM asks Director to prepare an image; it never submits a paid provider call. */
export type AskImageIntent = {
  prompt:string;
  aspectRatio:'1:1'|'9:16'|'16:9';
  operation:'text-to-image'|'image-to-image';
  providerPolicy:{localOnly:true;allowPaidWithoutApproval:false};
};

const createVerb=/\b(create|make|generate|draw|design|render|paint|produce|turn|edit)\b/i;
const imageNoun=/\b(image|picture|photo|portrait|illustration|artwork|poster|graphic|logo|sticker|shirt design|t-shirt design)\b/i;
const videoNoun=/\b(video|movie|film|clip|reel|animation|animate|footage)\b/i;

export function detectAskImageIntent(task:string, referenceAssetIds:readonly string[]=[]):AskImageIntent|undefined {
  const prompt=task.trim();
  if (!prompt || prompt.length>6000 || !createVerb.test(prompt) || !imageNoun.test(prompt) || videoNoun.test(prompt))
    return undefined;
  const width= /\b(9\s*:\s*16|portrait orientation|vertical image)\b/i.test(prompt)?'9:16':
    /\b(16\s*:\s*9|landscape orientation|wide image)\b/i.test(prompt)?'16:9':'1:1';
  return Object.freeze({
    prompt,aspectRatio:width,
    operation:referenceAssetIds.length?'image-to-image':'text-to-image',
    providerPolicy:Object.freeze({localOnly:true as const,allowPaidWithoutApproval:false as const}),
  });
}
