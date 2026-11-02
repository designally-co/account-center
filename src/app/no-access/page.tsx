import { Mark } from "@/components/mark";
import { signOut } from "../actions";

export default function NoAccessPage() {
  return (
    <main className="login">
      <div className="login-card">
        <span className="hero-mark"><Mark size={56} /></span>
        <div className="stack tight">
          <h1>Not in Account Center</h1>
          <p className="muted">Your account is not on Account Center&apos;s list, or it was removed. Ask an Account Center admin.</p>
        </div>
        <form action={signOut}><button type="submit" className="secondary">Sign out</button></form>
      </div>
    </main>
  );
}
