import { redirect } from "next/navigation";
import { isUuid } from "@/lib/ids";

type Search = Record<string, string | string[] | undefined>;

// A team opens as a popup on the Teams page since 2026-11-03 (Buk). Old links to a team's own page land there.
export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) redirect("/teams?notice=not-found");
  const notice = typeof search.notice === "string" && /^[a-z-]{1,40}$/.test(search.notice) ? `&notice=${search.notice}` : "";
  redirect(`/teams?team=${id}${notice}`);
}
