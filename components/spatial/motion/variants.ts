/**
 * Spatial Motion — Variants Framer Motion centralisés
 * Tous les composants spatiaux piochent ici pour la cohérence motion.
 */

import type { Variants } from "framer-motion";

export const EMERGE: Variants = {
  hidden: { opacity: 0, scale: 0.9, filter: "blur(20px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    filter: "blur(10px)",
    transition: { duration: 0.6, ease: [0.4, 0, 1, 1] },
  },
};

export const DISSOLVE: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 10,
    filter: "blur(4px)",
    transition: { duration: 0.5, ease: [0.4, 0, 1, 1] },
  },
};

export const SNAP: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

export const FLOAT_UP: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.95, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    filter: "blur(10px)",
    transition: { duration: 0.5, ease: "easeIn" },
  },
};

export const ORBITAL_NODE: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (delay: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay },
  }),
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.6, ease: "easeIn" },
  },
};

export const PANEL_EMERGE: Variants = {
  hidden: { opacity: 0, scale: 0.9, z: -100, filter: "blur(20px)" },
  visible: {
    opacity: 1,
    scale: 1,
    z: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    z: -50,
    filter: "blur(10px)",
    transition: { duration: 0.6, ease: "easeIn" },
  },
};

export const STAGGER_CHILDREN = {
  visible: { transition: { staggerChildren: 0.08 } },
};
