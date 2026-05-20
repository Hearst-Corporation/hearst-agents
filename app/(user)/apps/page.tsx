import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toQueryString(params: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * /apps — alias permanent vers le hub connexions (ConnectionsHub).
 * Conserve les query params OAuth (?connected=, ?slack=, etc.).
 */
export default async function AppsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  redirect(`/connections${toQueryString(params)}`);
}
