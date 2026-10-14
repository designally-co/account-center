import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUserId()) redirect("/");
  return (
    <main className="narrow">
      <h1>Account Center</h1>
      <p className="muted">Sign in with your Designally account. It is the same email and password as HR.</p>
      <SignInForm />
    </main>
  );
}
