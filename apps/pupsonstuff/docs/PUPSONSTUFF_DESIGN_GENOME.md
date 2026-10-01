# PupsonStuff Design Genome

**Status:** canonical experience contract  
**Scope:** `apps/pupsonstuff`  
**Visual anchor:** `public/boutique.png`  
**Product 3D registry:** `config/product3dModels.ts`  
**Commerce authority:** Stripe + PupsonStuff order ledger + certified Printify mapping  
**Creative authority:** PupsonStuff creative jobs/assets; Jhadina Compute describes governed execution placement but does not replace the business job.

## 1. The invariant

PupsonStuff is an interactive luxury pet boutique, not a conventional ecommerce grid and not a generic 3D demo.

The canonical boutique photograph is the store. Do not replace, restyle, redraw, crop into a different room, or make an experimental 3D room the default homepage. New capabilities must make the existing boutique feel alive.

The intended loop is:

```
enter the boutique
-> notice a subtle living product
-> tap the real item in the room
-> item lifts forward
-> studio opens
-> reuse a Pet Identity or upload 1–3 useful references
-> generate artwork
-> portrait reveals on an easel
-> approved artwork projects through the boutique
-> manipulate it on a real 3D product when a model exists
-> magnetic placement + print quality gate
-> approve exact print master
-> cart/Stripe
-> certified Printify fulfillment
-> customer tracks production/shipping
```

## 2. Visual identity

### Canonical room

- `public/boutique.png` is the visual source of truth.
- Desktop may show the full photograph.
- Mobile must prioritize immersion over fitting the entire wide photograph into a small portrait rectangle. Use a full-height horizontal viewport/pan while preserving hotspot/image alignment.
- The photograph must not be recomposed by AI merely to make responsive layout easier.
- Warm atmosphere overlays may be subtle and reversible; they may not obscure or materially recolor product details.

### Palette

The shipping UI uses the established cream / honey-oak / bronze / greige / ink / gold system already present in the app. New controls should feel like boutique fixtures, not SaaS dashboard widgets.

### Interaction language

Interactive products should feel alive before they look like buttons.

- breathing silhouette glow: quiet, always-on;
- brighter attention pass: randomized rather than a permanently repeated tour order;
- hover: subtle lift and shadow;
- touch: fast tactile response;
- selection: the photographed product itself lifts before the studio enters.

Never replace product silhouettes with generic rectangular cards over the store.

## 3. Navigation

The boutique has no mandatory global “3D / Photo” mode choice.

The photo boutique is always the storefront. 3D is a capability used when inspecting/customizing a product.

Department shortcuts may pan the boutique to useful clusters such as portraits, home goods, drinkware, apparel, studio, bags and checkout. They are navigation helpers, not a category-grid replacement.

Seasonal rooms, hidden Easter eggs, loyalty rooms, virtual dog parks and other dream features are optional future work, not launch requirements.

## 4. Pet Identity

A Pet Identity is durable, owner-scoped creative context.

Rules:

- one strong reference photo is enough;
- accept up to three references when extra angles/markings materially help;
- never require five photos;
- explicit processing consent is required when a Pet Identity is first created;
- a saved identity may be reused without re-uploading the same files;
- the signed owner cookie + Pet Identity ID define browser-session ownership;
- provider-neutral provenance must preserve every admitted reference;
- a new upload may intentionally create a new identity rather than silently mutating an old one.

The shopper-facing experience should make reuse obvious: “Use [pet name]” first, “New photos” as the alternative.

## 5. Boutique-wide personalization

Once a generation succeeds, that artwork should immediately appear throughout relevant product regions in the boutique. This is a delight/projection layer; it is not a production print master.

The broadcast preview must:

- never alter catalog identity or certified Printify mapping;
- never imply every product is already approved for purchase;
- disappear/recompute when the shopper intentionally replaces the Pet Identity or artwork;
- remain pointer-transparent so original hotspots still own interaction.

## 6. Portrait Studio

Generation should feel like an artist working, not a blocking API spinner.

After provider completion, reveal the portrait on an easel with a paint/reveal motion. The reveal is presentation only; the generated asset and its provenance remain the durable truth.

Animation/image-to-video is optional secondary delight. It must not become a fulfillment requirement.

## 7. Product 3D engine

### Approved repository assets

These files in `assets/approved` / `public/models` are the preferred product assets:

- shirt;
- hoodie;
- mug;
- pillow;
- bottle;
- tote.

Their approved/public SHA identity should stay synchronized. Do not regenerate them merely because another 3D model source exists.

Canvas uses a lightweight procedural stretcher-frame primitive because a bespoke GLB is unnecessary for a rectangular launch canvas.

### 3D ownership

`Product3DEngine` owns:

- product inspection/orbit;
- approved model loading;
- product color only where the material supports it;
- decal projection;
- the shopper's placement transform;
- screenshot/plugin extensions.

It does **not** own:

- catalog price authority;
- Printify provider IDs;
- order state;
- creative approval;
- whole-boutique navigation.

### Graceful degradation

If WebGL/model loading fails, customization must continue using the 2D placement editor and exact print-master pipeline. 3D is important presentation, never a reason to lose a sale.

## 8. Magnetic placement

Placement behavior should feel like Canva rather than raw coordinates.

- drag;
- pinch to resize;
- rotate;
- center and edge magnetic snapping;
- visible guides while manipulating;
- clamp the transformed artwork so its rotated footprint remains inside the editable print area;
- production composition still re-normalizes/clamps server-side.

The client editor is a preview. `buildPrintMaster` is the production authority.

## 9. Background and artwork policy

Background removal is the shopper default.

Supported intent:

- Remove;
- Keep;
- Generate.

The background-removal worker must process the generated output too, because an image generator can reintroduce background pixels after input preprocessing.

Upscaling is quality infrastructure, not a cosmetic filter. If the approved placement cannot meet the minimum effective print DPI and the configured upscaler cannot repair it, approval must fail closed.

## 10. 3D preview vs print truth

A nice 3D decal does not authorize production.

Checkout requires the exact approved production chain:

```
Pet Identity
-> Creative Job
-> Creative Output
-> placement transform
-> product/variant PrintProfile
-> print-ready asset
-> quality pass
-> customer approval
-> certified catalog snapshot
-> Stripe
-> Printify
```

Never infer Printify IDs from a 3D asset name.

## 11. Printify

Printify mapping lives in `pupson_catalog_variants`, not the storefront hotspot file.

Required launch behavior:

- discovery may find provider candidates;
- an operator certifies the exact mapping;
- dry-run may use `sandbox_verified`;
- real customer fulfillment requires `sample_verified`;
- the paid order stores the signed catalog snapshot;
- submission rechecks current mapping against that snapshot;
- print-ready image is uploaded to Printify;
- provider order ID and lifecycle are persisted;
- reconciliation updates shipment/tracking;
- failures never create blind duplicate provider orders.

`PUPSON_FULFILLMENT_MODE=live` is an operational gate, not a UI feature. Never switch it merely to make a demo appear complete.

## 12. Sound and delight

Sound should remain low, warm and non-intrusive.

- boutique theme starts only after first user interaction;
- remembered user disable/volume preferences are respected;
- music ducks during modal/generation work;
- lightweight product/success chimes may reinforce tactile actions;
- a sound failure must never block shopping.

Delight should come primarily from the product itself: glow, lift, easel reveal, boutique-wide pet projection, 3D inspection and clear order progress.

## 13. Checkout and customer tracking

The checkout counter is conceptually the store's cart anchor.

Stripe remains payment authority. After payment, the shopper should see a clear progress path:

1. payment received;
2. custom order prepared;
3. sent to production;
4. being made;
5. shipped;
6. delivered.

The customer tracker reads the same PupsonStuff/Printify records the admin and reconciliation path use. It must not manufacture a second tracking state.

## 14. Jhadina compute/creative boundary

PupsonStuff owns the durable creative business job, Pet Identity, outputs and approvals.

Each creative job also records a provider-neutral `@jhadina/compute-core` draft using the deployment profile `pupson.image.default`.

That draft:

- carries job/idempotency lineage;
- names the Pet Identity/product/style/source assets;
- marks pet-media workloads sensitive/local-first;
- does not authorize cloud burst;
- does not replace the PupsonStuff job record;
- does not bypass Jhadina action/compute submission authority.

Provider routing remains replaceable behind the PupsonStuff creative job. `lib/creative-provider.ts` is the provider-neutral execution seam for local/OpenAI/Muapi routes; future Jhadina workers plug in at that boundary. OpenAI/Muapi/other workers are execution mechanisms, not product-state authorities.

## 15. Mobile

Mobile is a first-class boutique experience.

- use `100dvh` where appropriate;
- let the wide boutique occupy full phone height and pan horizontally rather than shrinking into a postcard;
- keep cart/music/department controls reachable inside safe areas;
- touch targets must remain product-silhouette aligned;
- one-finger drag must not conflict with two-finger placement gestures inside the studio;
- 3D DPR and lighting should stay mobile-conscious.

## 16. Copy rules

PupsonStuff is warm, playful, visual and premium without being snobby.

Prefer:
- “Let’s make something”
- “Use [pet name]”
- “See [pet name] across the boutique”
- “Where’s my stuff?”

Avoid:
- cheap-drop-ship language;
- technical provider terminology in shopper copy;
- fake scarcity;
- implying an uncertified product is ready for production.

## 17. Non-negotiable launch safety

Do not claim launch completion until external evidence is real.

- dedicated deployment;
- production secrets;
- certified Printify mappings;
- Stripe/webhook proof;
- deployed end-to-end run;
- physical samples for launch variants;
- sample certification;
- controlled live fulfillment.

No code change may fabricate those receipts.

## 18. Reference lineage

This Genome consolidates the original PupsonStuff Boutique Bible, 3D boutique design boards, Store DNA/Design Genome discussions, the production closeout/reconciliation work, the existing approved 3D asset audits, and the current commerce/Printify contracts.

When an older reference conflicts with this document, this document wins unless the owner explicitly changes the product direction.
