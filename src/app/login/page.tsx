import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { Mark } from "@/components/mark";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUserId()) redirect("/");
  return (
    <main className="login">
      <div className="login-card">
        <span className="hero-mark"><Mark size={56} /></span>
        <div className="stack tight">
          <h1>Account Center</h1>
          <p className="muted">Sign in with your Designally account: your email and password.</p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
