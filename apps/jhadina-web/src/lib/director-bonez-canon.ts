import type {
  CharacterCastRecord,
  CharacterAppearanceVariant,
  CreativeDirective,
  ProductionAssetPackage,
  ProductionReferenceRole,
  WorldStateGraph,
  ProductIdentityBible,
} from '@jhadina/director-core';

export const BONEZ_PROJECT_ID='director:bonez:production-quality:v1';
export const BONEZ_CHARACTER_ID='bonez';
export const BONEZ_REFERENCE_ASSET_ID='director-ref:bonez:canonical:v2';
export const BONEZ_REFERENCE_SHA256='fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6';
export const BONEZ_REFERENCE_SOURCE_SHA256='fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6';
export const BONEZ_LEGACY_V1_SOURCE_SHA256='f50dbd93ab245e9098fb7237c8149cf20c445fe22fdea9070741f38f43d9c881';
export const BONEZ_PRODUCT_REFERENCE_ASSET_ID='director-ref:bonez:product-print:v2';
export const BONEZ_PRODUCT_REFERENCE_SHA256='fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6';
export const BONEZ_PRODUCT_ID='bonez-lair-art-print-v1';
export const BONEZ_RIGHTS_REF='model-generated-reference:bonez:v2:2026-09-29';

export const BONEZ_CANON = Object.freeze({
  series:'Tales from the Crip',
  name:'Bonez',
  confirmed:[
    'Bonez is a reanimated corpse.',
    'Bonez transcends time.',
    'Crip means Crypt; Bonez is chilling there by choice, not trapped.',
    'Bonez frequently breaks the fourth wall.',
    'Bonez is funny, cynical, wise, and evil.',
    'Bonez usually narrates and only occasionally enters a story directly.',
    'Bonez does not always drink coffee.',
    'Bonez does not have one fixed intro.',
    'Bonez does not always remain in his chair.',
    'The preferred home-base mood is a haunted trap-house / crypt-host lair.',
    'The visual target is photorealistic cinematic horror rather than a cartoon or clean skeleton.',
  ],
  visualAuthority:{
    source:'model-generated canonical derivative from the locked Bonez canon',
    sourceSha256:BONEZ_REFERENCE_SOURCE_SHA256,
    legacyV1SourceSha256:BONEZ_LEGACY_V1_SOURCE_SHA256,
    sanitizedReferenceSha256:BONEZ_REFERENCE_SHA256,
    immutable:[
      'deeply decayed skeletal corpse face with asymmetric organic decay',
      'long black dreadlocks/locs framing the skull, with occasional small beads/wraps',
      'dark layered tattered black/charcoal garments with distressed organic texture',
      'skeletal/decayed hands',
      'photoreal dark-cinematic material response',
    ],
    homeSet:[
      'worn black leather armchair',
      'black broadcast microphone on boom arm',
      'candle-lit decrepit plaster room with grime and cobwebs',
      'static CRT television',
      'bare exposed bulb',
      'purple-lit adjoining side room / threshold',
      'caution tape and layered story artifacts',
    ],
    optional:[
      'a held cup may appear but must never become mandatory coffee canon',
      'purple-glowing shades are episode-specific rather than permanent',
      'Bonez may sit, stand, walk, lean, gesture, or leave the chair',
    ],
  },
  behavior:{
    cadence:'unhurried host confidence; darkly amused rather than frantic',
    humor:'cynical, wicked, observational, capable of fourth-wall comments',
    wisdom:'streetwise and supernatural; can understand time-displaced events without over-explaining them',
    menace:'sinister pleasure and moral ambiguity; never flattened into a friendly mascot',
    narration:'typically frames or comments on anthology stories; direct intervention stays occasional',
  },
  nonCanonOrUnconfirmed:[
    'A fixed origin where Bonez was a podcaster/story addict killed by one cursed story is not confirmed canon.',
    'Any one proposed catchphrase is not mandatory canon.',
    'Any one cup/coffee gag is not mandatory canon.',
    'Bonez being imprisoned in the Crip is explicitly non-canon.',
  ],
});

export function bonezAppearance(approvedAt:string,approvedBy:string):CharacterAppearanceVariant{
  return Object.freeze({
    id:'appearance:bonez:canonical:v1',
    characterId:BONEZ_CHARACTER_ID,
    kind:'base',
    label:'Bonez canonical corpse host — v1',
    referenceAssetIds:Object.freeze([BONEZ_REFERENCE_ASSET_ID]),
    referenceSha256s:Object.freeze([BONEZ_REFERENCE_SHA256]),
    wardrobeNotes:Object.freeze([
      'layered tattered black/charcoal garments',
      'distressed, dirty, aged texture; never clean fashion-editorial styling',
      'silhouette can vary by scene only when decay, palette, and character identity remain intact',
    ]),
    appearanceNotes:Object.freeze([
      'deep corpse/skeletal facial decay with warm/orange eye presence',
      'long black locs/dreadlocks',
      'decayed skeletal hands',
      'photoreal practical-horror surface detail',
      'preserve asymmetry and damaged anatomy; do not replace with a generic white skeleton',
    ]),
    approvedAt,
    approvedBy,
  });
}

export function bonezCastRecord(approvedAt:string,approvedBy:string):CharacterCastRecord{
  const appearance=bonezAppearance(approvedAt,approvedBy);
  return Object.freeze({
    id:'cast:bonez:v1',
    projectId:BONEZ_PROJECT_ID,
    characterId:BONEZ_CHARACTER_ID,
    displayName:'Bonez',
    archetype:'creature',
    continuityRef:'bonez:continuity:v1',
    behaviorDnaRef:'bonez:behavior:v1',
    canonicalAppearanceVariantId:appearance.id,
    appearanceVariants:Object.freeze([appearance]),
    lockedTraits:Object.freeze([
      'reanimated corpse',
      'long black locs',
      'deep asymmetric facial decay',
      'decayed skeletal hands',
      'dark distressed layered clothing',
      'funny+cynical+wise+evil host temperament',
      'time-transcending awareness',
      'fourth-wall capability',
      'Crip is his chosen haunt, not a prison',
    ]),
    identityFingerprintRefs:Object.freeze([
      'sha256:'+BONEZ_REFERENCE_SHA256,
      'phash:bonez-face-v1:8dd96246a79dcb18',
      'dhash:bonez-face-v1:69337372f2f5a78f',
      'phash:bonez-upper-v1:98dd7b226d06d286',
    ]),
    approvedAt,
    approvedBy,
  });
}

function assetPackage(input:{
  id:string;kind:ProductionAssetPackage['kind'];displayName:string;
  tags:string[];immutable:string[];changeable:string[];
  spatial?:ProductionAssetPackage['spatial'];commercialProductRef?:string;
  referenceAssetId?:string;referenceSha256?:string;referenceRole?:ProductionReferenceRole;
},now:string):ProductionAssetPackage{
  const role:ProductionReferenceRole=input.referenceRole??(input.kind==='character'?'face':input.kind==='environment'?'other':input.kind==='wearable'?'body':'in-use');
  const refs=[{
    id:'ref:'+input.id,
    assetId:input.referenceAssetId??BONEZ_REFERENCE_ASSET_ID,
    sha256:input.referenceSha256??BONEZ_REFERENCE_SHA256,
    role,
    rightsRef:BONEZ_RIGHTS_REF,
    evidenceIds:['model-generated:bonez:canonical-v2','sanitized-reference:'+BONEZ_REFERENCE_SHA256],
  }] as const;
  const sourceFingerprint=refs.map(ref=>ref.id+':'+ref.role+':'+ref.sha256.toLowerCase()).sort().join('|');
  return Object.freeze({
    id:input.id,version:1,kind:input.kind,displayName:input.displayName,
    canonicalReferences:Object.freeze(refs),
    sourceFingerprint,
    descriptiveTags:Object.freeze(input.tags),
    immutableTraits:Object.freeze(input.immutable),
    changeableTraits:Object.freeze(input.changeable),
    ...(input.spatial?{spatial:input.spatial}:{}),
    derivedPayloads:Object.freeze([]),
    rights:Object.freeze({ownership:'authorized',commercialUse:'agreement-dependent',disclosureRefs:Object.freeze(['source:model-generated-canon-v2'])}),
    ...(input.commercialProductRef?{commercialProductRef:input.commercialProductRef}:{}),
    createdAt:now,updatedAt:now,authority:'DIRECTOR_PRODUCTION_ASSET_PACKAGE',
  });
}

export function bonezAssetPackages(now:string):readonly ProductionAssetPackage[]{
  return Object.freeze([
    assetPackage({
      id:'assetpkg:bonez:v1',kind:'character',displayName:'Bonez',
      tags:['reanimated corpse','crypt host','hood horror','photoreal','long black locs'],
      immutable:['facial decay topology','long black locs','skeletal hands','dark corpse material response'],
      changeable:['pose','expression intensity','position in set','episode-specific accessories'],
    },now),
    assetPackage({
      id:'assetpkg:bonez:wardrobe:v1',kind:'wearable',displayName:'Bonez canonical distressed layers',
      tags:['black','charcoal','tattered','aged','layered'],
      immutable:['dark distressed palette','aged/torn material language'],
      changeable:['layer arrangement','hood up/down','minor episode-specific additions'],
      spatial:{interactionAnchors:[{id:'anchor:wardrobe:torso',name:'torso garment surface',affordances:['wear','touch']}]},
    },now),
    assetPackage({
      id:'assetpkg:crip-lair:v1',kind:'environment',displayName:'The Crip / Bonez Lair',
      tags:['haunted trap house','crypt','candlelight','grime','cobwebs','purple side room','CRT static'],
      immutable:['decrepit practical-horror texture','warm candle/bulb zone','purple-lit secondary zone','story-artifact clutter'],
      changeable:['artifact arrangement','episode clues','portal/map element','number of candles'],
      spatial:{interactionAnchors:[
        {id:'anchor:lair:chair-zone',name:'host chair zone',affordances:['stand','sit','cross']},
        {id:'anchor:lair:threshold',name:'purple room threshold',affordances:['cross','enter','exit']},
      ]},
    },now),
    assetPackage({
      id:'assetpkg:bonez-chair:v1',kind:'furniture',displayName:'Bonez worn black leather armchair',
      tags:['black leather','worn','host chair'],
      immutable:['dark worn leather','deep armchair silhouette'],
      changeable:['set position','camera angle'],
      spatial:{interactionAnchors:[
        {id:'anchor:chair:seat',name:'seat',affordances:['sit','stand-from']},
        {id:'anchor:chair:arm-left',name:'left armrest',affordances:['rest-hand','grip']},
        {id:'anchor:chair:arm-right',name:'right armrest',affordances:['rest-hand','grip']},
      ]},
    },now),
    assetPackage({
      id:'assetpkg:bonez-mic:v1',kind:'prop',displayName:'Bonez broadcast microphone',
      tags:['black microphone','boom arm','podcast host'],
      immutable:['large black cylindrical microphone','boom-arm mounting'],
      changeable:['boom angle','distance from Bonez'],
      spatial:{interactionAnchors:[{id:'anchor:mic:grille',name:'microphone grille',affordances:['speak-toward']}]},
    },now),
    assetPackage({
      id:'assetpkg:bonez-print:v1',kind:'product',displayName:'Tales from the Crip — Bonez Lair Art Print',
      tags:['limited edition','art print','Bonez','Tales from the Crip'],
      immutable:['canonical Bonez Lair artwork'],
      changeable:['physical print size','frame treatment'],
      commercialProductRef:BONEZ_PRODUCT_ID,
      referenceAssetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,
      referenceSha256:BONEZ_PRODUCT_REFERENCE_SHA256,
      referenceRole:'front',
    },now),
  ]);
}

export function bonezWorldState(now:string):WorldStateGraph{
  const entities:WorldStateGraph['entities']=[
    {id:'world-entity:bonez',kind:'character',label:'Bonez',productionAssetPackageRef:'assetpkg:bonez:v1',affordances:['narrate','walk','sit','stand','gesture','hold'],evidenceIds:['canon:bonez']},
    {id:'world-entity:crip',kind:'location',label:'The Crip / Bonez Lair',productionAssetPackageRef:'assetpkg:crip-lair:v1',affordances:['host','contain'],evidenceIds:['canon:bonez:lair']},
    {id:'world-entity:chair',kind:'asset',label:'Bonez chair',productionAssetPackageRef:'assetpkg:bonez-chair:v1',affordances:['sit','stand-from','rest-hand','grip'],evidenceIds:['image:bonez:chair']},
    {id:'world-entity:mic',kind:'asset',label:'broadcast microphone',productionAssetPackageRef:'assetpkg:bonez-mic:v1',affordances:['speak-toward'],evidenceIds:['image:bonez:mic']},
  ];
  const relations:WorldStateGraph['relations']=[
    {id:'rel:bonez:at:crip',subjectId:'world-entity:bonez',kind:'at',objectId:'world-entity:crip',validFrom:now,evidenceIds:['canon:bonez:crip-choice']},
    {id:'rel:chair:at:crip',subjectId:'world-entity:chair',kind:'at',objectId:'world-entity:crip',validFrom:now,evidenceIds:['image:bonez:chair']},
    {id:'rel:mic:at:crip',subjectId:'world-entity:mic',kind:'at',objectId:'world-entity:crip',validFrom:now,evidenceIds:['image:bonez:mic']},
    {id:'rel:bonez:seated',subjectId:'world-entity:bonez',kind:'seated-on',objectId:'world-entity:chair',validFrom:now,evidenceIds:['image:bonez:canonical-state'],validTo:now},
  ];
  return Object.freeze({
    id:'world:bonez-crip:v1',projectId:BONEZ_PROJECT_ID,kind:'fictional',version:1,
    entities:Object.freeze([...entities]),
    relations:Object.freeze([...relations]),
    authority:'DIRECTOR_WORLD_STATE',
  });
}

export function bonezCreativeDirectives(now:string):readonly CreativeDirective[]{
  const items:Array<Omit<CreativeDirective,'projectId'|'createdBy'|'createdAt'|'evidenceIds'>>=[
    {id:'directive:bonez:identity',scope:'character',scopeRef:BONEZ_CHARACTER_ID,key:'identity-core',mode:'pin',value:['reanimated corpse','long black locs','deep asymmetric decay','skeletal hands']},
    {id:'directive:bonez:no-generic-skeleton',scope:'character',scopeRef:BONEZ_CHARACTER_ID,key:'generic-skeleton-swap',mode:'forbid'},
    {id:'directive:bonez:no-clean-human',scope:'character',scopeRef:BONEZ_CHARACTER_ID,key:'clean-human-skin',mode:'forbid'},
    {id:'directive:bonez:movement',scope:'character',scopeRef:BONEZ_CHARACTER_ID,key:'movement',mode:'allow',value:['sit','stand','walk','lean','gesture','leave-chair']},
    {id:'directive:bonez:no-mandatory-coffee',scope:'asset',scopeRef:BONEZ_CHARACTER_ID,key:'mandatory-coffee-or-cup',mode:'forbid'},
    {id:'directive:bonez:no-fixed-intro',scope:'project',scopeRef:BONEZ_PROJECT_ID,key:'fixed-intro',mode:'forbid'},
    {id:'directive:bonez:no-prison',scope:'project',scopeRef:BONEZ_PROJECT_ID,key:'crip-as-prison',mode:'forbid'},
    {id:'directive:bonez:tone',scope:'project',scopeRef:BONEZ_PROJECT_ID,key:'visual-tone',mode:'pin',value:'photoreal cinematic hood-horror; sinister, funny, grimy, practical-textured; never bright mascot comedy'},
    {id:'directive:bonez:origin',scope:'character',scopeRef:BONEZ_CHARACTER_ID,key:'unconfirmed-origin',mode:'forbid',value:'Do not canonize the proposed cursed-podcaster/story-addict death origin without user approval.'},
  ];
  const directives:CreativeDirective[]=items.map(item=>({
    ...item,
    projectId:BONEZ_PROJECT_ID,
    createdBy:'user',
    createdAt:now,
    evidenceIds:Object.freeze(['user-canon:bonez']),
  }));
  return Object.freeze(directives.map(directive=>Object.freeze(directive)));
}

export function bonezProductBible():ProductIdentityBible{
  const bible:ProductIdentityBible={
    id:'product-bible:bonez-lair-print:v1',
    projectId:BONEZ_PROJECT_ID,
    productId:BONEZ_PRODUCT_ID,
    displayName:'Tales from the Crip — Bonez Lair Limited Art Print',
    canonicalVariantId:'bonez-lair-canonical-art-v1',
    referenceViews:Object.freeze([{
      id:'product-view:bonez-print:front',
      assetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,
      sha256:BONEZ_PRODUCT_REFERENCE_SHA256,
      view:'front',
      evidenceIds:Object.freeze(['model-generated:bonez:canonical-v2','product-fixture:flat-art-print']),
    }]),
    labelAuthorities:Object.freeze([]),
    immutableTraits:Object.freeze([
      'canonical Bonez Lair artwork',
      'Bonez remains the central depicted character',
    ]),
    claimEvidenceIds:Object.freeze([]),
    rightsEvidenceIds:Object.freeze([BONEZ_RIGHTS_REF]),
  };
  return Object.freeze(bible);
}
