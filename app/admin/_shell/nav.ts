/**
 * Admin sidebar nav config — single source of truth for the admin shell.
 *
 * Adding a section: extend NAV_SECTIONS. The SVG icon is rendered from `iconPath`
 * (24×24 viewBox, stroke="currentColor"). The route must already exist as a
 * working page under app/admin/.
 */

export type NavItem = {
  href: string;
  label: string;
  iconPath: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Pipeline",
    items: [
      {
        href: "/admin",
        label: "Accueil",
        iconPath:
          "M3 10 12 3l9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z",
      },
      {
        href: "/admin/pipeline",
        label: "Pipeline",
        iconPath:
          "M3 3h6v6H3zM3 15h6v6H3zM15 15h6v6h-6zM15 3h6v6h-6zM6 9v6m9-9h-3a3 3 0 0 0-3 3v3",
      },
      {
        href: "/admin/agents",
        label: "Agents",
        iconPath:
          "M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zM6 22v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2",
      },
      {
        href: "/admin/runs",
        label: "Runs",
        iconPath: "M5 4l14 8-14 8V4z",
      },
    ],
  },
  {
    title: "Orchestration",
    items: [
      {
        href: "/admin/orchestrator/overview",
        label: "Vue d'ensemble",
        iconPath:
          "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
      },
      {
        href: "/admin/orchestrator/command-center",
        label: "Command Center",
        iconPath:
          "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
      },
      {
        href: "/admin/orchestrator/registry",
        label: "Registry",
        iconPath:
          "M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z",
      },
      {
        href: "/admin/orchestrator/runs",
        label: "Runs HOM",
        iconPath: "M5 4l14 8-14 8V4z",
      },
      {
        href: "/admin/orchestrator/trust",
        label: "Trust",
        iconPath:
          "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
      },
    ],
  },
  {
    title: "Système",
    items: [
      {
        href: "/admin/metrics",
        label: "Métriques",
        iconPath:
          "M3 3v18h18M7 16l4-4 4 4 4-4",
      },
      {
        href: "/admin/analytics",
        label: "Analytics",
        iconPath:
          "M3 3v18h18M7 13l4-4 4 4 4-4 -4-4",
      },
      {
        href: "/admin/health",
        label: "Health",
        iconPath:
          "M22 12h-4l-3 9L9 3l-3 9H2",
      },
      {
        href: "/admin/audit",
        label: "Audit",
        iconPath:
          "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6M9 9h2",
      },
      {
        href: "/admin/agent-driven-dev",
        label: "Gouvernance",
        iconPath:
          "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
      },
      {
        href: "/admin/settings",
        label: "Settings",
        iconPath:
          "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
      },
    ],
  },
];

/**
 * Resolve the active item for a given pathname. Longest `href` gagne pour que
 * `/admin/agents/xyz` batte `/admin`.
 */
export function activeItem(pathname: string): NavItem | null {
  const n = pathname.replace(/\/$/, "") || "/";
  let best: NavItem | null = null;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const exact = n === item.href;
      const nested = n.startsWith(`${item.href}/`);
      if (!exact && !nested) continue;
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}
