import { describe, expect, it } from 'vitest';

import { compileLaunchReview } from '../scripts/printify-launch-review';

function resolvedGroup(
  fulfillmentProductId: string,
  dimension: string,
  variantId: number
) {
  return {
    fulfillmentProductId,
    status: 'RESOLVED' as const,
    chosenBlueprint: { blueprintId: 101, title: 'Blueprint' },
    chosenProvider: { printProviderId: 202, title: 'Provider' },
    matchedVariants: [
      {
        dimension,
        printifyVariantId: variantId,
        printifyVariantTitle: 'Variant',
      },
    ],
    artworkPlacement: {
      requestedPrintArea: 'front',
      availablePlaceholderPositions: ['front'],
      suggestedPosition: 'front',
      note: 'exact',
    },
  };
}

describe('Printify launch review compiler', () => {
  it('produces raw-blueprint certification candidates for exactly matched launch variants', () => {
    const review = compileLaunchReview({
      generatedAt: '2026-09-24T00:00:00.000Z',
      blocked: false,
      groups: [
        resolvedGroup('canvas', 'Size: 12×16 in', 11),
        resolvedGroup('mug', 'Size: 11oz, Color: White', 22),
        resolvedGroup('tee-concert', 'Size: M, Color: Black', 33),
      ],
    });

    expect(review.ready).toBe(true);
    expect(review.targets).toHaveLength(3);
    expect(review.targets.map((target) => target.candidate?.providerVariantId)).toEqual([
      '11',
      '22',
      '33',
    ]);
    expect(review.targets.every((target) => target.candidate?.providerProductId === null)).toBe(
      true
    );
  });

  it('blocks an ambiguous exact launch variant instead of choosing one', () => {
    const group = resolvedGroup('mug', 'Size: 11oz, Color: White', 22);
    group.matchedVariants.push({
      dimension: 'Size: 11oz, Color: White',
      printifyVariantId: 23,
      printifyVariantTitle: 'Second match',
    });

    const review = compileLaunchReview({
      generatedAt: '2026-09-24T00:00:00.000Z',
      blocked: false,
      groups: [
        resolvedGroup('canvas', 'Size: 12×16 in', 11),
        group,
        resolvedGroup('tee-concert', 'Size: M, Color: Black', 33),
      ],
    });

    const mug = review.targets.find((target) => target.productId === 'mugWhite');
    expect(review.ready).toBe(false);
    expect(mug?.candidate).toBeNull();
    expect(mug?.reasons.join(' ')).toContain('More than one catalog variant matched');
  });
});
