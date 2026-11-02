import { Mark } from "@/components/mark";
import { ForgotForm } from "./form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="login">
      <div className="login-card">
        <span className="hero-mark"><Mark size={56} /></span>
        <div className="stack tight">
          <h1>Forgot your password?</h1>
          <p className="muted">Type the email you sign in with. We send you a link to choose a new password.</p>
        </div>
        <ForgotForm />
      </div>
    </main>
  );
}
