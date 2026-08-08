import Image from "next/image";

/**
 * The boutique photo is the homepage. This component only ever displays it
 * — it never crops, stretches, or recomposes it.
 *
 * IMPORTANT: this no longer owns its own aspect-ratio box. It fills
 * whatever box its parent (Boutique.tsx) provides. Hotspots.tsx fills that
 * exact same box as a sibling. That's the fix for the alignment bug: image
 * and hotspot layer must render inside one shared container, or they can
 * drift apart at viewport sizes where object-contain letterboxes the image.
 */
export default function BoutiqueImage() {
  return (
    <Image
      src="/boutique.png"
      alt="PupsonStuff boutique — luxury pet portrait store interior"
      fill
      priority
      sizes="100vw"
      className="object-contain"
    />
  );
}
