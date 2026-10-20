import { BRAND_HUE, Orb } from "@/components/orb";
import { ForgotForm } from "./form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="login">
      <div className="login-card">
        <span className="orb-wrap"><Orb seed="account_center" hue={BRAND_HUE} size={88} /></span>
        <div className="stack tight">
          <h1>Forgot your password?</h1>
          <p className="muted">Type the email you sign in with. We send you a link to choose a new password.</p>
        </div>
        <ForgotForm />
      </div>
    </main>
  );
}
