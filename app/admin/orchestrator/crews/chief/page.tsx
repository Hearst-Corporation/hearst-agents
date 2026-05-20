import { redirect } from "next/navigation";

export default function ChiefOfStaffIndex(): never {
  redirect("/admin/orchestrator/crews/chief/history");
}
