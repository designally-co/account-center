// account-recover: "Forgot password" (see _shared/core.ts, recover). Open to anyone, deployed with JWT
// checking off; it always gives the same answer, so it never tells whether an email has an account.
import { recover } from "../_shared/core.ts";
import { serve } from "../_shared/deno.ts";

serve((deps, _req, body) => recover(deps, body.email));
