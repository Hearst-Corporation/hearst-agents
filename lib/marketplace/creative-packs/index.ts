/**
 * Creative Packs builtins — 10 templates créatifs préconfigurés (S4-D).
 *
 * Code-as-data : ces packs sont livrés avec l'app et fusionnés dans la
 * marketplace via `lib/marketplace/store.ts`. Ils n'existent pas en DB,
 * leurs IDs sont préfixés `builtin:` (cf. BUILTIN_CREATIVE_PACK_ID_PREFIX).
 *
 * Chaque pack cible un provider créatif (Runway, HeyGen, fal, ElevenLabs)
 * avec un prompt prêt à l'emploi + paramètres (durée, ratio, ton). Les tags
 * et `recommendedFor` (persona IDs) permettent une reco contextuelle dans
 * la page marketplace selon la persona active du tenant.
 *
 * Usage : VideoQuickLaunch / AssetVariantTabs peuvent cloner le payload
 * directement dans leur état local pour pré-remplir le launcher.
 */

import type {
  CreativePromptPayload,
  MarketplaceTemplate,
} from "@/lib/marketplace/types";

export const BUILTIN_CREATIVE_PACK_ID_PREFIX = "builtin:creative-pack:";

const NOW = "1970-01-01T00:00:00.000Z";
const AUTHOR_TENANT = "builtin";
const AUTHOR_USER = "builtin";
const AUTHOR_NAME = "Hearst OS";

interface PackSeed {
  slug: string;
  title: string;
  description: string;
  payload: CreativePromptPayload;
  isFeatured?: boolean;
}

const SEEDS: PackSeed[] = [
  {
    slug: "hotel-luxury-lobby",
    title: "Hôtel · Lobby luxe heure dorée",
    description:
      "Vidéo Runway cinématique d'un lobby d'hôtel haut de gamme, lumière dorée et marbre poli.",
    isFeatured: true,
    payload: {
      prompt:
        "Cinematic slow dolly through the lobby of a luxury 5-star hotel at golden hour. Polished marble floors, brass detailing, soft ambient sunlight filtering through tall windows. Quiet luxury aesthetic, no people. 35mm film grain, shallow depth of field.",
      provider: "runway",
      kind: "video",
      params: { duration: 6, ratio: "1280:720", tone: "cinematic" },
      tags: ["hospitality", "luxury", "lobby", "cinematic"],
      recommendedFor: ["builtin:hospitality-concierge"],
    },
  },
  {
    slug: "product-hero",
    title: "Produit · Hero shot premium",
    description:
      "Image fal d'un produit isolé sur fond neutre, éclairage studio premium, rendu commercial.",
    payload: {
      prompt:
        "Premium product hero shot, single object centered on a soft gradient backdrop. Studio softbox lighting from upper-left, subtle reflection underneath. Editorial commercial style, ultra-sharp focus, neutral palette.",
      provider: "fal",
      kind: "image",
      params: { ratio: "1280:720", tone: "premium" },
      tags: ["product", "hero", "premium", "ecommerce"],
      recommendedFor: [],
    },
  },
  {
    slug: "editorial-abstract",
    title: "Éditorial · Abstrait cinématique",
    description:
      "Vidéo Runway abstraite, mouvements lents de matière, voile de fumée et reflets liquides.",
    payload: {
      prompt:
        "Abstract editorial visual: slow-moving plumes of black smoke meeting iridescent liquid reflections. Macro lens, deep blacks, single accent color (warm amber). Silent luxury mood, no text, no logo.",
      provider: "runway",
      kind: "video",
      params: { duration: 8, ratio: "1280:720", tone: "editorial" },
      tags: ["editorial", "abstract", "cinematic", "art"],
      recommendedFor: [],
    },
  },
  {
    slug: "brand-story-narration",
    title: "Brand · Voix narrative 30 sec",
    description:
      "Audio ElevenLabs : narration de marque 30 secondes, voix posée, ton inspirationnel.",
    payload: {
      prompt:
        "Narration de marque, voix française masculine grave et posée. Ton inspirationnel mais sobre. 30 secondes. Texte : « Depuis dix ans, nous bâtissons l'élégance à hauteur d'homme. Chaque détail est une promesse. Bienvenue chez nous. »",
      provider: "elevenlabs",
      kind: "audio",
      params: { duration: 30, tone: "inspirational" },
      tags: ["brand", "narration", "voice", "story"],
      recommendedFor: ["builtin:formal"],
    },
  },
  {
    slug: "event-recap",
    title: "Événement · Recap cinématique 10 sec",
    description:
      "Vidéo Runway recap d'événement corporate, montage rapide, ambiance célébration sobre.",
    isFeatured: true,
    payload: {
      prompt:
        "Cinematic event recap: rapid cuts of an elegant corporate gala — clinking glasses, candlelit tables, silhouettes mingling, key speaker on stage backlit. Warm tungsten tones, anamorphic lens flares, no faces in focus.",
      provider: "runway",
      kind: "video",
      params: { duration: 10, ratio: "1280:720", tone: "cinematic" },
      tags: ["event", "recap", "corporate", "cinematic"],
      recommendedFor: ["builtin:cockpit"],
    },
  },
  {
    slug: "restaurant-mood",
    title: "Restaurant · Intérieur moody",
    description:
      "Image fal d'une salle de restaurant chaleureuse, bougies allumées, ambiance soirée intime.",
    payload: {
      prompt:
        "Restaurant interior, late evening. Moody warm lighting, candles on every table, soft shadows on dark wood walls. Empty, no people. Luxurious yet intimate, shot on medium format film, slight grain.",
      provider: "fal",
      kind: "image",
      params: { ratio: "1280:720", tone: "moody" },
      tags: ["hospitality", "restaurant", "interior", "moody"],
      recommendedFor: ["builtin:hospitality-concierge"],
    },
  },
  {
    slug: "founder-keynote-intro",
    title: "Fondateur · Intro keynote",
    description:
      "Vidéo HeyGen avatar fondateur, intro keynote, ton confiant pour ouverture de présentation.",
    payload: {
      prompt:
        "Bonjour à toutes et à tous. Je suis ravi de vous accueillir aujourd'hui pour partager notre vision. Ce que vous allez voir n'est pas une simple mise à jour produit — c'est le résultat de deux ans de travail au plus près de nos clients. Préparez-vous, je crois que cela va vous plaire.",
      provider: "heygen",
      kind: "video",
      params: { duration: 15, ratio: "1280:720", tone: "confident" },
      tags: ["founder", "keynote", "intro", "presentation"],
      recommendedFor: ["builtin:cockpit", "builtin:default"],
    },
  },
  {
    slug: "morning-coffee-aesthetic",
    title: "Café matinal · Flat lay esthétique",
    description:
      "Image fal d'un flat lay café du matin, ambiance lente, palette neutre, lumière douce.",
    payload: {
      prompt:
        "Top-down flat lay: a single ceramic cup of espresso, an open notebook with handwritten notes, a vintage fountain pen, dried eucalyptus sprig. Linen tablecloth, morning light from the side, neutral palette of beige and cream. Slow living aesthetic.",
      provider: "fal",
      kind: "image",
      params: { ratio: "1280:720", tone: "aesthetic" },
      tags: ["lifestyle", "coffee", "flatlay", "aesthetic"],
      recommendedFor: ["builtin:casual"],
    },
  },
  {
    slug: "portrait-cinematic",
    title: "Portrait · Cinématique DOF court",
    description:
      "Image fal portrait studio cinématique, profondeur de champ courte, regard pensif.",
    payload: {
      prompt:
        "Cinematic portrait of a person in their 30s, looking slightly off-camera with a contemplative expression. Studio key light from the side, deep shadow on the opposite cheek. Shallow depth of field (f/1.4), 85mm lens compression. Editorial monochrome with warm undertone.",
      provider: "fal",
      kind: "image",
      params: { ratio: "720:1280", tone: "cinematic" },
      tags: ["portrait", "cinematic", "editorial", "studio"],
      recommendedFor: ["builtin:default"],
    },
  },
  {
    slug: "city-skyline-dusk",
    title: "Ville · Skyline crépuscule",
    description:
      "Vidéo Runway skyline urbain au crépuscule, time-lapse vers la nuit, lumières qui s'allument.",
    payload: {
      prompt:
        "Sweeping aerial view of a modern city skyline at dusk transitioning to night. Time-lapse of windows lighting up across glass towers, traffic streaks below, deep magenta-to-indigo sky. Smooth slow zoom-out, no logos visible.",
      provider: "runway",
      kind: "video",
      params: { duration: 8, ratio: "1280:720", tone: "cinematic" },
      tags: ["city", "skyline", "dusk", "aerial"],
      recommendedFor: ["builtin:cockpit"],
    },
  },
];

/**
 * Templates marketplace builtins (creative_prompt) générés depuis SEEDS.
 *
 * Stables : ID = `builtin:creative-pack:<slug>` ; auteurs synthétiques
 * (`builtin` tenant/user) pour distinguer des publications utilisateur.
 */
export const CREATIVE_PACKS_BUILTINS: MarketplaceTemplate[] = SEEDS.map(
  (seed) => ({
    id: `${BUILTIN_CREATIVE_PACK_ID_PREFIX}${seed.slug}`,
    kind: "creative_prompt",
    title: seed.title,
    description: seed.description,
    authorDisplayName: AUTHOR_NAME,
    authorTenantId: AUTHOR_TENANT,
    authorUserId: AUTHOR_USER,
    tags: seed.payload.tags.slice(0, 5),
    ratingAvg: 0,
    ratingCount: 0,
    cloneCount: 0,
    isFeatured: seed.isFeatured ?? false,
    createdAt: NOW,
    updatedAt: NOW,
    payload: seed.payload,
  }),
);

/**
 * True si l'ID désigne un pack créatif builtin (préfixe stable).
 * Permet aux callers (ex: cloneTemplate) de bypasser la lecture Supabase.
 */
export function isBuiltinCreativePackId(id: string): boolean {
  return id.startsWith(BUILTIN_CREATIVE_PACK_ID_PREFIX);
}

/**
 * Lookup builtin par ID (None si pas trouvé).
 */
export function getBuiltinCreativePack(
  id: string,
): MarketplaceTemplate | null {
  return CREATIVE_PACKS_BUILTINS.find((p) => p.id === id) ?? null;
}
