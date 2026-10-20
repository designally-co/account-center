// account-invite: an Account Center admin gives a person a login (see _shared/core.ts, invite).
// Deployed with JWT checking off: the function checks the admin's token itself, with Friday's Auth.
import { invite } from "../_shared/core.ts";
import { serve } from "../_shared/deno.ts";

serve((deps, req, body) => {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  return invite(deps, bearer, body.person_id, body.link_existing === true);
});
