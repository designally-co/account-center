import { db } from "@/lib/db";

// For the container health check on the NAS: the server answers and can reach its schema.
// `commit` says which release is running (set in the image by the release workflow).
export const dynamic = "force-dynamic";

export async function GET() {
  const commit = process.env.APP_COMMIT_SHA || null;
  try {
    const [row] = await db()<{ apps: number }[]>`select count(*)::int as apps from account.apps`;
    return Response.json({ ok: true, commit, apps: row?.apps ?? 0 });
  } catch {
    return Response.json({ ok: false, commit }, { status: 503 });
  }
}
