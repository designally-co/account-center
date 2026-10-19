import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";

// Sign-in goes through Project Friday's Auth, on the server only. The browser never talks to Supabase.
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a page, where cookies cannot be set; the middleware refreshes the session instead.
        }
      },
    },
  });
}
