import { db } from "@/lib/db";

// For the container health check on the NAS: the server answers and can reach its schema.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [row] = await db()<{ apps: number }[]>`select count(*)::int as apps from account.apps`;
    return Response.json({ ok: true, apps: row?.apps ?? 0 });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
