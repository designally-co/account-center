import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND_HUE, Orb } from "@/components/orb";
import { meByUser } from "@/lib/access";
import { db } from "@/lib/db";
import { currentSignIn } from "@/lib/session";
import { PasswordForm } from "./form";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Choose a password: right after an invitation or reset link, or any time from Home.
export default async function PasswordPage({ searchParams }: { searchParams: Promise<Search> }) {
  const signIn = await currentSignIn();
  if (!signIn) redirect("/login");
  const me = await meByUser(db(), signIn.userId);
  if (!me) redirect("/no-access");
  const welcome = (await searchParams).welcome === "1" && signIn.byLinkRecently;
  return (
    <main className="login">
      <div className="login-card">
        <span className="orb-wrap"><Orb seed="account_center" hue={BRAND_HUE} size={88} /></span>
        <div className="stack tight">
          <h1>{welcome ? `Welcome, ${me.display_name}` : "Choose a password"}</h1>
          <p className="muted">{welcome ? "Choose your password. You sign in with it and your email." : signIn.byLinkRecently ? "Choose a new password." : "Type your current password, then the new one."}</p>
        </div>
        <PasswordForm askCurrent={!signIn.byLinkRecently} />
        {!welcome ? <p><Link href="/" className="back">Cancel</Link></p> : null}
      </div>
    </main>
  );
}
