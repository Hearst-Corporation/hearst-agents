"use client";

import { createContext, useContext } from "react";
import type { CockpitProduct } from "./types";
import type { ChatConfig } from "../chat/types";
import { DEFAULT_PRODUCT_COLOR } from "./tokens";

export interface CockpitContextValue {
  products: CockpitProduct[];
  appId: string;
  chatConfig: ChatConfig;
  /** Helper : produit par id, fallback sur l'appId si inconnu, sinon premier produit. */
  getProduct: (id: string) => CockpitProduct;
}

const HUB_FALLBACK: CockpitProduct = {
  id: "hub",
  name: "Hearst Corporation",
  short: "HC",
  color: DEFAULT_PRODUCT_COLOR,
};

export const CockpitContext = createContext<CockpitContextValue>({
  products: [HUB_FALLBACK],
  appId: "hub",
  chatConfig: {},
  getProduct: () => HUB_FALLBACK,
});

export function useCockpit(): CockpitContextValue {
  return useContext(CockpitContext);
}
