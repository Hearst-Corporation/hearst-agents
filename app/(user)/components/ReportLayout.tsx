"use client";

/**
 * Shim de re-export — l'implémentation vit dans `./report-layout/`.
 * Conserve l'API publique historique : `ReportLayout`, `isReportPayload`.
 */

export { ReportLayout, isReportPayload } from "./report-layout";
export type { ReportLayoutProps } from "./report-layout";
