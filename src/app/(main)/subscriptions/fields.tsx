// The subscription's details, shared by "Add subscription" and each subscription's page. No password field,
// on purpose: passwords stay in the company's password manager.
export function SubscriptionFields({ value }: { value?: { name: string; shared_email: string; plan: string; url: string | null; renews_on: string | null } }) {
  return (
    <>
      <label className="field">Tool <input name="name" required maxLength={60} placeholder="Claude" defaultValue={value?.name} /></label>
      <label className="field">Shared login email
        <input name="shared_email" type="email" required maxLength={320} placeholder="team-login@designally.co" defaultValue={value?.shared_email} autoComplete="off" />
      </label>
      <label className="field">Plan (optional) <input name="plan" maxLength={60} placeholder="Team, 5 seats" defaultValue={value?.plan} /></label>
      <label className="field">Sign-in address (optional) <input name="url" maxLength={300} placeholder="https://claude.ai" defaultValue={value?.url ?? ""} /></label>
      <label className="field">Renews on (optional) <input name="renews_on" type="date" defaultValue={value?.renews_on ?? ""} /></label>
      <p className="muted small-text">Never type a password here. Passwords stay in the company&apos;s password manager.</p>
    </>
  );
}

// The next payment, in words. Soon (two weeks or less) and passed are marked, so nobody misses a renewal.
export function renewText(date: string | null, today = new Date()): { text: string; tone: "plain" | "soon" | "past" } | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((d.getTime() - day) / 86_400_000);
  const when = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (days < 0) return { text: `Renewal date passed (${when})`, tone: "past" };
  if (days === 0) return { text: "Renews today", tone: "soon" };
  if (days <= 14) return { text: `Renews in ${days} ${days === 1 ? "day" : "days"}`, tone: "soon" };
  return { text: `Renews ${when}`, tone: "plain" };
}
