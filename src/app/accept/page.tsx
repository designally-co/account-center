import { BRAND_HUE, Orb } from "@/components/orb";
import { AcceptForm } from "./form";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Where invitation and reset emails lead. The link is used only when the person presses the button, so an
// email scanner that opens links cannot use it up.
export default async function AcceptPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const type = search.type === "recovery" ? "recovery" : "invite";
  const tokenHash = typeof search.token_hash === "string" ? search.token_hash : "";
  return (
    <main className="login">
      <div className="login-card">
        <span className="orb-wrap"><Orb seed="account_center" hue={BRAND_HUE} size={88} /></span>
        <div className="stack tight">
          <h1>{type === "invite" ? "Welcome" : "Reset your password"}</h1>
          <p className="muted">
            {type === "invite"
              ? "Accept your invitation, then choose your password and make your avatar."
              : "Continue to choose a new password."}
          </p>
        </div>
        <AcceptForm type={type} tokenHash={tokenHash} button={type === "invite" ? "Accept the invitation" : "Continue"} />
      </div>
    </main>
  );
}
