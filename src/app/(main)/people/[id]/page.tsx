import { redirect } from "next/navigation";
import { isUuid } from "@/lib/ids";

type Search = Record<string, string | string[] | undefined>;

// A person opens as a popup on the People page since 2026-11-03 (Buk). Old links to a person's own page land there.
export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) redirect("/people?notice=no-person");
  const notice = typeof search.notice === "string" && /^[a-z0-9-]{1,60}$/.test(search.notice) ? `&notice=${search.notice}` : "";
  redirect(`/people?person=${id}${notice}`);
}
