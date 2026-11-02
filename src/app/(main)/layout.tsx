import { Nav } from "@/components/nav";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requirePerson } from "@/lib/session";

// Every signed-in page shares this layout, so the bar at the top stays while the next page loads. Each page
// still checks its own access on the server.
// No loading.tsx outlines, on purpose: with one above a page, a save that comes back to the same page (the
// visible/hidden button, adding someone to a subscription) hung in "Saving…" (Next.js 15.5, found
// 2026-11-02). The progress line in the bar shows at once instead.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { userId, me } = await requirePerson();
  const canView = await canUser(db(), userId, ACTIONS.view);
  return (
    <>
      <Nav me={me} canView={canView} />
      {children}
    </>
  );
}
