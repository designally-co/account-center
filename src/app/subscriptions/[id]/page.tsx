import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { candidatesFor, getSubscription } from "@/lib/subscriptions";
import { addMemberAction, removeMemberAction, setSubscriptionActiveAction, updateSubscriptionAction } from "../actions";
import { SubscriptionFields, renewText } from "../fields";
import { SUBSCRIPTION_NOTICES } from "../notices";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function SubscriptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [sub, canManage, candidates] = await Promise.all([getSubscription(sql, id), canUser(sql, userId, ACTIONS.manage), candidatesFor(sql, id)]);
  if (!sub) notFound();
  const key = typeof search.notice === "string" ? search.notice : "";
  const notice = Object.hasOwn(SUBSCRIPTION_NOTICES, key) ? SUBSCRIPTION_NOTICES[key] : null;
  const left = sub.members.filter((m) => !m.is_active);
  const renew = renewText(sub.renews_on);

  return (
    <>
      <Nav current="subscriptions" me={me} canView />
      <main className="wide">
        <p><Link href="/subscriptions" className="back">← Shared subscriptions</Link></p>
        <div className="top">
          <div>
            <h1>{sub.name}</h1>
            <p className="muted">
              {sub.shared_email}
              {sub.plan ? ` · ${sub.plan}` : ""}
              {renew ? ` · ${renew}` : ""}
              {sub.is_active ? "" : " · turned off"}
            </p>
            {sub.url ? <p className="small-text"><a href={sub.url} target="_blank" rel="noopener noreferrer">{sub.url.replace(/^https:\/\//, "")}</a></p> : null}
          </div>
          {canManage ? (
            <form action={setSubscriptionActiveAction}>
              <input type="hidden" name="subscription_id" value={sub.id} />
              <input type="hidden" name="active" value={sub.is_active ? "0" : "1"} />
              <button type="submit" className="secondary">{sub.is_active ? "Turn off" : "Turn on"}</button>
            </form>
          ) : null}
        </div>

        {notice ? (notice.tone === "ok" ? <Toast text={notice.text} /> : <p className="notice error" role="alert">{notice.text}</p>) : null}
        {!canManage ? <p className="notice">View only</p> : null}
        {left.length ? (
          <p className="notice warn" role="status">
            {left.map((m) => m.display_name).join(", ")} {left.length === 1 ? "has" : "have"} left the company and knew this login.
            Change the password in {sub.name} and in the password manager, then take {left.length === 1 ? "them" : "them"} off below.
          </p>
        ) : null}

        <section className="stack" aria-labelledby="members-title">
          <h2 id="members-title">Who may use it</h2>
          {sub.members.length === 0 ? <p className="empty">Nobody yet.</p> : (
            <ul className="team-members">
              {sub.members.map((m) => (
                <li key={m.id}>
                  <Link href={`/people/${m.id}`}>
                    <Avatar avatar={m.avatar} seed={m.id} size={36} />
                    <span>{m.display_name}</span>
                  </Link>
                  <span className="row">
                    {m.is_active ? null : <span className="pill warn">Left</span>}
                    {canManage ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="subscription_id" value={sub.id} />
                        <input type="hidden" name="person_id" value={m.id} />
                        <button type="submit" className="secondary small" aria-label={`Take ${m.display_name} off ${sub.name}`}>Take off</button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage && sub.is_active && candidates.length ? (
            <form action={addMemberAction} className="row">
              <input type="hidden" name="subscription_id" value={sub.id} />
              <label htmlFor="add-person" className="sr-only">Person to add</label>
              <select id="add-person" name="person_id" required defaultValue="">
                <option value="" disabled>Choose a person</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <button type="submit" className="secondary">Add</button>
            </form>
          ) : null}
        </section>

        {canManage ? (
          <section className="panel stack" aria-labelledby="details-title">
            <h2 id="details-title">Details</h2>
            <form action={updateSubscriptionAction} className="stack">
              <input type="hidden" name="subscription_id" value={sub.id} />
              <SubscriptionFields value={sub} />
              <div><button type="submit" className="secondary">Save</button></div>
            </form>
          </section>
        ) : null}
      </main>
    </>
  );
}
