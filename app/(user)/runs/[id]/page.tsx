/**
 * /runs/[id] — Deeplink vers un run existant.
 *
 * Server Component qui vérifie l'auth, lookup le run par id + tenant_id,
 * et redirige vers /run?id={id} pour réutiliser l'UI existante de MissionStage.
 * Retourne 404 si le run n'existe pas ou n'appartient pas au tenant courant.
 */

import { notFound, redirect } from "next/navigation";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { scope, error } = await requireScope({ context: "RSC app/(user)/runs/[id]/page.tsx" });
  if (error || !scope) {
    redirect("/login");
  }

  const sb = requireServerSupabase();
  const { data: run } = await sb
    .from("runs")
    .select("id, tenant_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();

  if (!run) {
    notFound();
  }

  redirect(`/run?id=${id}`);
}
