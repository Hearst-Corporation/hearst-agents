"use client";

/**
 * Shim de re-export — l'implémentation vit dans `./report-layout/`.
 * Conserve l'API publique historique : `ReportLayout`, `isReportPayload`.
 */

export type { ReportLayoutProps } from "./report-layout";
export { isReportPayload, ReportLayout } from "./report-layout";
