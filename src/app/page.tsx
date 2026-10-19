import Link from "next/link";
import { ACTIONS, canUser } from "@/lib/access";
import { accessSummary, getPersonAccess } from "@/lib/access-lists";
import { db } from "@/lib/db";
import { requirePerson } from "@/lib/session";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { AppIcon } from "@/components/app-icon";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Every company person can open Home: their avatar and their own access. Nothing about anyone else.
export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requirePerson();
  const sql = db();
  const [access, canView, search] = await Promise.all([getPersonAccess(sql, me.person_id), canUser(sql, userId, ACTIONS.view), searchParams]);
  // What the real check gives: roles, plus or minus single changes, never an app the kind is kept out of.
  const mine = (access?.apps ?? []).map((app) => ({ app, s: accessSummary(app, access?.kind ?? "") })).filter(({ s }) => s.on > 0);
  return (
    <>
      <Nav current="home" me={me} canView={canView} />
      <main className="wide">
        {search.notice === "avatar-saved" ? <p className="notice ok" role="status">Avatar saved.</p> : null}
        {search.notice === "not-allowed" ? <p className="notice error" role="alert">You do not have access to that page.</p> : null}
        {search.notice === "password-saved" ? <p className="notice ok" role="status">Password saved. Other browsers signed in to your account were signed out.</p> : null}
        <div className="person-head">
          <Link href="/avatar" className="avatar-edit" aria-label="Change your avatar">
            <Avatar avatar={me.avatar} seed={me.person_id} size={88} />
            <span className="avatar-edit-label" aria-hidden="true">Edit</span>
          </Link>
          <div className="stack tight">
            <h1>Hello, {me.display_name}</h1>
            <p className="muted">{me.avatar === null ? <Link href="/avatar">Make your avatar</Link> : "Your access in Designally's apps"}</p>
            <p className="small-text"><Link href="/password" className="back">Change password</Link></p>
          </div>
        </div>

        {mine.length ? (
          <ul className="app-cards" aria-label="Your apps">
            {mine.map(({ app }) => {
              const inner = (
                <>
                  <AppIcon appKey={app.key} icon={app.icon} hue={app.hue} size={48} />
                  <span className="app-card-text">
                    <strong>{app.name}</strong>
                    {app.description ? <span className="muted">{app.description}</span> : null}
                  </span>
                  {app.url ? <span className="app-card-go" aria-hidden="true">↗</span> : <span className="pill plain">Not online yet</span>}
                </>
              );
              const outside = app.url?.startsWith("https://");
              return (
                <li key={app.key}>
                  {app.url ? (
                    <a className="app-card" href={app.url} {...(outside ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {inner}<span className="sr-only">{outside ? " (opens in a new tab)" : ""}</span>
                    </a>
                  ) : <div className="app-card off">{inner}</div>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty">No app access yet. An Account Center admin gives it.</p>
        )}
      </main>
    </>
  );
}
