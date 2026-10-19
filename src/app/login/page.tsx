import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { BRAND_HUE, Orb } from "@/components/orb";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUserId()) redirect("/");
  return (
    <main className="login">
      <div className="login-card">
        <span className="orb-wrap"><Orb seed="account_center" hue={BRAND_HUE} size={88} /></span>
        <div className="stack tight">
          <h1>Account Center</h1>
          <p className="muted">Sign in with your Designally account. Same email and password as HR.</p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
