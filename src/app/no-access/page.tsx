import { Orb } from "@/components/orb";
import { signOut } from "../actions";

export default function NoAccessPage() {
  return (
    <main className="login">
      <div className="login-card">
        <span className="orb-wrap"><Orb seed="designally-account-center" size={88} /></span>
        <div className="stack tight">
          <h1>No access yet</h1>
          <p className="muted">Ask an Account Center admin to give you access, then sign in again.</p>
        </div>
        <form action={signOut}><button type="submit" className="secondary">Sign out</button></form>
      </div>
    </main>
  );
}
