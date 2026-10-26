import { db } from "@/lib/db";

// For the container health check on the NAS: the server answers and can reach its schema.
// `commit` says which release is running (set in the image by the release workflow).
export const dynamic = "force-dynamic";

export async function GET() {
  const commit = process.env.APP_COMMIT_SHA || null;
  try {
    const sql = db();
    // The newest database changes must be there too (up to migration 20261026100000, shared subscriptions):
    // a release whose database is behind reports 503 instead of breaking pages.
    await sql`select kind, avatar from account.people limit 0`;
    await sql`select hue, url, icon, description, art from account.apps limit 0`;
    await sql`select 1 from account.person_actions limit 0`;
    await sql`select 1 from account.team_members limit 0`;
    await sql`select name, shared_email, plan, url, renews_on from account.subscriptions limit 0`;
    await sql`select 1 from account.subscription_members limit 0`;
    const [row] = await sql<{ apps: number }[]>`select count(*)::int as apps from account.apps`;
    return Response.json({ ok: true, commit, apps: row?.apps ?? 0 });
  } catch {
    return Response.json({ ok: false, commit }, { status: 503 });
  }
}
