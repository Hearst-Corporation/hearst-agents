// Types et constantes partagés du hub Connections.
//
// Surface 100% interne au module. Aucun de ces types n'est exporté hors du
// dossier `connections/` — la surface publique reste `<ConnectionsHub />`.

export interface ConnectedAccount {
  id: string;
  appName: string;
  status: string;
  // "composio" = OAuth via Composio (handleConnect popup + handleDisconnect).
  // "native"   = obtenu via le SSO NextAuth (Gmail/Cal/Drive après login
  //              Google, Outlook après login MS). Pas de OAuth séparé à
  //              tenter, le drawer affiche une note "géré via SSO" au lieu
  //              du bouton Connecter/Déconnecter.
  source?: "composio" | "native";
}

export interface ComposioApp {
  key: string;
  name: string;
  description: string;
  logo: string;
  categories: string[];
  noAuth: boolean;
  // `false` = aucune auth-config côté tenant Composio → click "Connecter"
  // donnerait NO_INTEGRATION. UI : tile grayscale plus fort + cadenas, drawer
  // remplace le bouton OAuth par un lien vers la config Composio.
  connectable?: boolean;
}

export interface DiscoveredTool {
  name: string;
  description: string;
  app: string;
}

export interface DrawerState {
  app: ComposioApp;
  connectedAccount?: ConnectedAccount;
}

const CATEGORY_LABEL: Record<string, string> = {
  communication: "Communication",
  productivity: "Productivité",
  crm: "CRM & Ventes",
  "developer-tools": "Développement",
  design: "Design",
  ats: "RH & Recrutement",
  scheduling: "Planification",
  ai: "IA & Données",
  analytics: "Analytics",
  marketing: "Marketing",
  finance: "Finance",
  ticketing: "Support",
  "team-collaboration": "Collaboration",
  "project-management": "Projets",
  "task-management": "Tâches",
  documents: "Documents",
  accounting: "Comptabilité",
  storage: "Stockage",
  social: "Social",
  ecommerce: "E-commerce",
  hr: "RH",
  legal: "Juridique",
  hosting: "Hébergement",
};

export function categoryLabel(app: ComposioApp): string {
  const first = app.categories[0];
  if (!first) return "service";
  return CATEGORY_LABEL[first] ?? first;
}

export function categoryLabelById(id: string): string {
  return CATEGORY_LABEL[id] ?? id;
}

// Search intent-based : mappings de mots-clés naturels (FR + EN) vers les
// slugs Composio. Quand l'utilisateur tape un mot d'intention au lieu d'un
// nom de service, on remonte les services pertinents en TÊTE des résultats
// (priorité éditoriale), avant le match fuzzy nom/description classique.
//
// Ex : "facturer" → Stripe en 1er même si Stripe ne contient pas le mot
// "facturer" dans sa description anglaise.
export const INTENT_KEYWORDS: { keywords: string[]; slugs: string[] }[] = [
  {
    keywords: ["facture", "facturer", "facturation", "invoice", "billing", "paiement"],
    slugs: ["stripe", "quickbooks", "pennylane"],
  },
  {
    keywords: ["agenda", "calendrier", "rdv", "rendez-vous", "schedule", "planifier"],
    slugs: ["googlecalendar", "calendly", "outlook"],
  },
  {
    keywords: ["ticket", "issue", "bug", "sprint", "tracker"],
    slugs: ["linear", "github", "jira"],
  },
  {
    keywords: ["email", "mail", "courriel", "newsletter"],
    slugs: ["gmail", "outlook", "mailchimp", "sendgrid"],
  },
  {
    keywords: ["doc", "document", "note", "wiki", "documentation"],
    slugs: ["notion", "googledocs", "googledrive", "confluence"],
  },
  {
    keywords: ["crm", "contact", "lead", "deal", "prospect"],
    slugs: ["hubspot", "salesforce", "pipedrive", "attio"],
  },
  {
    keywords: ["chat", "messagerie", "channel", "équipe", "conversation"],
    slugs: ["slack", "discord", "teams"],
  },
  {
    keywords: ["design", "maquette", "wireframe", "ui"],
    slugs: ["figma"],
  },
  {
    keywords: ["code", "repo", "pr", "pull request", "commit", "review"],
    slugs: ["github", "gitlab", "bitbucket"],
  },
  {
    keywords: ["meet", "réunion", "visio", "video", "call"],
    slugs: ["zoom", "googlemeet", "teams"],
  },
  {
    keywords: ["analytics", "metric", "dashboard", "kpi"],
    slugs: ["mixpanel", "amplitude", "posthog", "segment"],
  },
  {
    keywords: ["support", "ticket client", "helpdesk"],
    slugs: ["zendesk", "intercom", "freshdesk", "helpscout"],
  },
];

// Picks recommandés par défaut. Liste large (≥10) pour qu'après filtrage
// des déjà-connectés on ait toujours 3 dispos. `hint` = micro-descripteur
// affiché sous le nom dans la card (remplace la catégorie générique pour
// donner du contexte utile : "que fait Hearst avec ce service").
export const SUGGESTION_PICKS: { slug: string; hint: string }[] = [
  { slug: "stripe", hint: "facturation & paiements" },
  { slug: "linear", hint: "tickets & sprints produit" },
  { slug: "calendly", hint: "planification de RDV" },
  { slug: "hubspot", hint: "CRM, contacts & deals" },
  { slug: "github", hint: "PR, issues, code review" },
  { slug: "notion", hint: "docs, bases & comptes-rendus" },
  { slug: "googlecalendar", hint: "agenda & créneaux libres" },
  { slug: "slack", hint: "messages & mentions équipe" },
  { slug: "figma", hint: "specs design & maquettes" },
  { slug: "gmail", hint: "emails & threads priorisés" },
  { slug: "airtable", hint: "bases relationnelles" },
  { slug: "googledrive", hint: "fichiers & docs partagés" },
];

// Priorité de statut : plus petit = meilleur. Quand un service a plusieurs
// connexions (ex: Slack ACTIVE + EXPIRED), on affiche le plus favorable.
export const STATUS_RANK: Record<string, number> = {
  active: 0, initiated: 1, pending: 2, failed: 3, error: 3, expired: 4,
};

// Wallpaper : combien de tuiles on affiche d'office. Sur 1030 apps, charger
// tout d'un coup tue le DOM ; on lazy-charge par paliers de WALLPAPER_PAGE.
export const WALLPAPER_PAGE = 100;

// Catégories visibles en chips (les autres regroupées dans "+ N catégories").
export const CATEGORIES_VISIBLE = 8;

// Starter pack pour les utilisateurs sans connexion. Quatre slugs Composio
// "essentiels" pour 80 % des cas d'usage (agenda, équipe, doc, fichiers).
// Si ces apps sont absentes du catalogue (ex: connectable=false côté tenant),
// elles n'apparaissent simplement pas dans le starter pack.
export const STARTER_PICKS = ["googlecalendar", "slack", "notion", "googledrive"];

// Combien d'actions on affiche par défaut dans le drawer avant le « voir tout ».
export const ACTIONS_PREVIEW = 8;

// Variante visuelle dérivée du status. Active = silencieux ; warn/error =
// dot coloré + label texte sous le nom.
export function stageVariant(status: string): "active" | "warn" | "error" {
  switch (status) {
    case "initiated":
    case "pending":
      return "warn";
    case "error":
    case "failed":
    case "expired":
      return "error";
    default:
      return "active";
  }
}

// Première phrase de la description Composio, tronquée à ~120 chars. Évite les
// blocs verbeux remplis de "This action allows you to…".
export function truncateDescription(desc: string): string | null {
  if (!desc) return null;
  const cleaned = desc.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  const max = 120;
  if (firstSentence.length <= max) return firstSentence;
  return firstSentence.slice(0, max).trimEnd() + "…";
}

export function actionLabel(action: DiscoveredTool): string {
  // Composio slug = APP_VERB_OBJECT → "Send email", etc.
  const parts = action.name.split("_");
  if (parts.length <= 1) return action.description || action.name;
  const verb = parts[1].toLowerCase();
  const object = parts.slice(2).join(" ").toLowerCase();
  return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${object}`.trim();
}
