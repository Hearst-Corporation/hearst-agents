/**
 * useSafeSession — wrapper sûr autour de useSession().
 *
 * useSession() throw si rendu hors d'un SessionProvider (preview, tests
 * unitaires). On l'attrape pour ne pas casser ces contextes : ReportLayout
 * doit pouvoir rendre un payload sans dépendance auth (ex. page publique
 * partagée, preview studio, snapshots de test).
 */

import { type SessionContextValue, useSession } from "next-auth/react";

export function useSafeSession(): SessionContextValue["data"] {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useSession();
    return data;
  } catch {
    return null;
  }
}
