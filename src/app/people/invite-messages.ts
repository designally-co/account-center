// What the admin reads after giving someone a login. Messages come from this fixed list only.
export const INVITE_MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  sent: { tone: "ok", text: "Invitation sent. They accept it from their email, then choose a password and make their avatar." },
  linked: { tone: "ok", text: "The existing login was linked. No email was sent: they sign in with their current password, or use \"Forgot your password?\"." },
  "account-exists": { tone: "error", text: "A login with this email already exists (for example HR made it). It was not linked, because anyone may have made it. Link it only if you know it is this person's." },
  "account-unconfirmed": { tone: "error", text: "A login with this email exists, but its email was never confirmed, so it cannot be linked. Ask the Account Center owner to check it." },
  "mail-off": { tone: "error", text: "The email could not be sent: email is not set up yet. Copy the invitation link below and send it to them yourself (LINE or email)." },
  "mail-failed": { tone: "error", text: "The email could not be sent. Copy the invitation link below and send it to them yourself (LINE or email)." },
  "too-soon": { tone: "error", text: "An invitation was sent less than a minute ago. Wait a minute, then send it again." },
  "has-login": { tone: "error", text: "They already have a working login. If they forgot their password, they can use \"Forgot your password?\" on the sign-in page." },
  "account-taken": { tone: "error", text: "The login for this email already belongs to another person in Account Center." },
  "account-blocked": { tone: "error", text: "Their login is blocked, so no invitation was sent." },
  "account-missing": { tone: "error", text: "Their old login no longer exists. Ask the Account Center owner to check it before making a new one." },
  "no-person": { tone: "error", text: "That person was not found, or was removed." },
  "not-allowed": { tone: "error", text: "Not sent: you can no longer manage Account Center. Ask another admin." },
  "bad-request": { tone: "error", text: "Something was wrong with the request. Reload the page and try again." },
  "auth-failed": { tone: "error", text: "The sign-in service did not answer. Try again in a minute." },
  unreachable: { tone: "error", text: "The sign-in service did not answer. Try again in a minute." },
};

export function inviteMessage(key: string | undefined) {
  return key && Object.hasOwn(INVITE_MESSAGES, key) ? INVITE_MESSAGES[key] : null;
}
