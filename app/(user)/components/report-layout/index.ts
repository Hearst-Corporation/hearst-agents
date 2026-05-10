/**
 * Barrel export du module report-layout.
 *
 * Le shim historique `app/(user)/components/ReportLayout.tsx` ré-exporte
 * depuis ici pour garder l'API publique stable (props, isReportPayload).
 */

export { ReportLayout } from "./ReportLayout";
export type { ReportLayoutProps } from "./ReportLayout";
export { isReportPayload } from "./utils";
