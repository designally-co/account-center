import Link from "next/link";
import { Nav } from "@/components/nav";
import { ACTIONS } from "@/lib/access";
import { listKinds } from "@/lib/access-lists";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { NewPersonForm } from "./form";

export const dynamic = "force-dynamic";

// An admin adds a new company person and sends them an invitation. Their app access is set on their page
// afterwards, like everyone else's.
export default async function NewPersonPage() {
  const { me } = await requireAction(ACTIONS.manage);
  const kinds = await listKinds(db());
  return (
    <>
      <Nav current="people" me={me} canView />
      <main className="narrow-form">
        <p><Link href="/people" className="back">← People</Link></p>
        <div className="stack tight">
          <h1>Add person</h1>
          <p className="muted">They get an email to accept, choose a password and make their avatar.</p>
        </div>
        <NewPersonForm kinds={kinds.map(({ key, name }) => ({ key, name }))} />
      </main>
    </>
  );
}
