import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/admin/permissions";
import { getHearstSession, isDevBypassEnabled } from "@/lib/platform/auth";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import AdminShell from "./_shell/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getHearstSession();
  const devBypass = isDevBypassEnabled();

  if (!session?.user && !devBypass) {
    redirect("/login?callbackUrl=/admin");
  }

  // Vérification du rôle admin (sauf en dev bypass où l'auth est simulée)
  if (!devBypass && session?.user) {
    const db = getServerSupabase();
    if (db) {
      // session.user.id n'existe pas dans le type NextAuth de base —
      // l'userId canonique est dans session.userId (augmenté dans next-auth.d.ts).
      const userId =
        (session as { userId?: string }).userId ?? (session.user as { id?: string }).id;
      const tenantId =
        (session as { tenantId?: string }).tenantId ??
        (session.user as { tenantId?: string }).tenantId;
      if (userId) {
        const role = await getUserRole(db, userId, tenantId);
        if (role !== "admin") {
          redirect("/");
        }
      }
    }
  }

  const userLabel =
    session?.user?.name ?? session?.user?.email ?? (devBypass ? "Admin (dev)" : "Admin");
  const userInitial = (userLabel.trim()[0] ?? "A").toUpperCase();
  const env = (process.env.HEARST_ENV ?? process.env.NODE_ENV ?? "dev").toLowerCase();

  return (
    <AdminShell userLabel={userLabel} userInitial={userInitial} env={env}>
      {children}
    </AdminShell>
  );
}
