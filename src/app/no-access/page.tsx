import { signOut } from "../actions";

export default function NoAccessPage() {
  return (
    <main className="narrow">
      <h1>No access yet</h1>
      <p>Your account is signed in, but it has no role in Account Center.</p>
      <p className="muted">Ask an Account Center admin to give you a role. Then sign in again.</p>
      <form action={signOut}><button type="submit" className="secondary">Sign out</button></form>
    </main>
  );
}
