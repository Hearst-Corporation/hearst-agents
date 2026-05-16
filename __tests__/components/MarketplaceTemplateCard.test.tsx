/**
 * @vitest-environment jsdom
 *
 * MarketplaceTemplateCard — render, kind, rating, clones, featured.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceTemplateCard } from "@/app/(user)/components/marketplace/MarketplaceTemplateCard";
import type { MarketplaceTemplateSummary } from "@/lib/marketplace/types";

function fixture(overrides: Partial<MarketplaceTemplateSummary> = {}): MarketplaceTemplateSummary {
  return {
    id: "tpl-1",
    kind: "workflow",
    title: "Daily standup",
    description: "Synthèse quotidienne GitHub + Linear → Slack",
    authorDisplayName: "Hearst OS",
    authorTenantId: "hearst-builtin",
    tags: ["standup", "slack"],
    ratingAvg: 4.5,
    ratingCount: 12,
    cloneCount: 28,
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("MarketplaceTemplateCard", () => {
  it("rend titre, description, auteur", () => {
    render(<MarketplaceTemplateCard template={fixture()} />);
    expect(screen.getByText("Daily standup")).toBeTruthy();
    expect(screen.getByText(/Synthèse quotidienne/)).toBeTruthy();
    expect(screen.getByText("Hearst OS")).toBeTruthy();
  });

  it("affiche les tags", () => {
    render(<MarketplaceTemplateCard template={fixture()} />);
    expect(screen.getByText("standup")).toBeTruthy();
    expect(screen.getByText("slack")).toBeTruthy();
  });

  it("affiche le rating quand count > 0", () => {
    render(<MarketplaceTemplateCard template={fixture()} />);
    // Rating avec étoile
    const node = screen.getByTitle(/4\.5 \/ 5/);
    expect(node).toBeTruthy();
  });

  it("affiche tiret quand pas de rating", () => {
    render(<MarketplaceTemplateCard template={fixture({ ratingAvg: 0, ratingCount: 0 })} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("expose Anonyme quand authorDisplayName null", () => {
    render(<MarketplaceTemplateCard template={fixture({ authorDisplayName: null })} />);
    expect(screen.getByText("Anonyme")).toBeTruthy();
  });

  it("affiche le compte de clones", () => {
    render(<MarketplaceTemplateCard template={fixture({ cloneCount: 1 })} />);
    expect(screen.getByText("1 clone")).toBeTruthy();
  });

  it("ne rend pas de lien tant que la page détail n'existe pas", () => {
    // La route `/marketplace/[id]` n'est pas livrée. La card reste donc
    // descriptive plutôt que de mener à une 404 ; le testid suffit aux
    // futurs câblages.
    const { container } = render(<MarketplaceTemplateCard template={fixture()} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector('[data-testid="marketplace-card-tpl-1"]')).toBeTruthy();
  });
});
