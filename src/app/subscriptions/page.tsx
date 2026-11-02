import Link from "next/link";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { listSubscriptions } from "@/lib/subscriptions";
import { createSubscriptionAction } from "./actions";
import { SubscriptionFields, renewText } from "./fields";
import { SUBSCRIPTION_NOTICES } from "./notices";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Shared subscriptions (Buk, 2026-10-26): tools several people use with one shared company login.
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [subs, canManage, search] = await Promise.all([listSubscriptions(sql), canUser(sql, userId, ACTIONS.manage), searchParams]);
  const key = typeof search.notice === "string" ? search.notice : "";
  const notice = Object.hasOwn(SUBSCRIPTION_NOTICES, key) ? SUBSCRIPTION_NOTICES[key] : null;

  return (
    <>
      <Nav current="subscriptions" me={me} canView />
      <main className="wide">
        <div className="top">
          <div>
            <h1>Shared subscriptions</h1>
            <p className="muted">Tools the company pays for, used by several people with one shared login. Who may use each one. Never the password.</p>
          </div>
        </div>

        {notice ? (notice.tone === "ok" ? <Toast text={notice.text} /> : <p className="notice error" role="alert">{notice.text}</p>) : null}

        {subs.length === 0 ? <p className="empty">No shared subscriptions yet.</p> : (
          <ul className="team-cards" aria-label="Shared subscriptions">
            {subs.map((s) => {
              const people = s.members.filter((m) => m.is_active);
              const left = s.members.length - people.length;
              const renew = renewText(s.renews_on);
              return (
                <li key={s.id} className={`team-card${s.is_active ? "" : " faded"}`}>
                  <div className="team-card-head">
                    <Link href={`/subscriptions/${s.id}`} className="team-card-name">{s.name}</Link>
                    {s.is_active ? null : <span className="pill muted">Turned off</span>}
                  </div>
                  <p className="small-text">{s.shared_email}</p>
                  {s.plan || renew ? <p className="muted small-text">{[s.plan, renew].filter(Boolean).join(" · ")}</p> : null}
                  <div className="team-card-avatars" aria-label={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
                    {people.slice(0, 8).map((m) => (
                      <span key={m.id} title={m.display_name}><Avatar avatar={m.avatar} seed={m.id} size={32} /></span>
                    ))}
                    {people.length > 8 ? <span className="more">+{people.length - 8}</span> : null}
                    {people.length === 0 ? <span className="muted small-text">Nobody yet</span> : null}
                  </div>
                  {left ? <p><span className="pill warn">{left} {left === 1 ? "person" : "people"} left: change the password</span></p> : null}
                </li>
              );
            })}
          </ul>
        )}

        {canManage ? (
          <section className="panel stack" aria-labelledby="new-subscription">
            <h2 id="new-subscription">Add subscription</h2>
            <form action={createSubscriptionAction} className="stack">
              <SubscriptionFields />
              <div><button type="submit">Add subscription</button></div>
            </form>
          </section>
        ) : null}
      </main>
    </>
  );
}
