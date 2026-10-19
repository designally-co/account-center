// Deno side of Account Center's server functions: settings from the function's environment, then the
// shared logic in core.ts. Friday provides SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL;
// the others are set as function secrets (docs/apply-to-friday.md, "Server functions").
import postgres from "postgres";
import { type Deps, type Reply, resendSender } from "./core.ts";

function need(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function serve(handle: (deps: Deps, req: Request, body: Record<string, unknown>) => Promise<Reply>) {
  Deno.serve(async (req) => {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (req.method !== "POST") return json(405, { error: "method-not-allowed" });
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { error: "bad-request" });
      body = parsed as Record<string, unknown>;
    } catch {
      return json(400, { error: "bad-request" });
    }
    const sql = postgres(need("SUPABASE_DB_URL"), { max: 1, prepare: false, onnotice: () => {} });
    try {
      const deps: Deps = {
        sql,
        authUrl: `${need("SUPABASE_URL").replace(/\/+$/, "")}/auth/v1`,
        serviceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
        appUrl: Deno.env.get("ACCOUNT_APP_URL") || "https://account.designally.co",
        orgName: Deno.env.get("ACCOUNT_ORG_NAME") || "Designally",
        sendMail: resendSender({
          apiKey: Deno.env.get("RESEND_API_KEY"),
          from: Deno.env.get("ACCOUNT_MAIL_FROM") || "Designally <people@designally.co>",
          endpoint: Deno.env.get("ACCOUNT_MAIL_ENDPOINT") || undefined,   // local tests only: a stand-in inbox
        }),
      };
      const out = await handle(deps, req, body);
      return json(out.status, out.body);
    } catch {
      console.error("[account] the request failed");
      return json(500, { error: "failed" });
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
}
