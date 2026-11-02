import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { candidatesFor, getSubscription } from "@/lib/subscriptions";
import { addMemberAction, removeMemberAction, setSubscriptionActiveAction, updateSubscriptionAction } from "../actions";
import { SubscriptionFields, renewText } from "../fields";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
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
      <main className="wide">
        <p><Link href="/subscriptions" className="back">← Shared subscriptions</Link></p>
        <div className="top">
          <div>
            <h1>{sub.name}</h1>
            <p className="muted">
              {sub.shared_email}
              {sub.plan ? ` · ${sub.plan}` : ""}
              {renew ? <> · <span className={renew.tone === "soon" ? "renew-soon" : renew.tone === "past" ? "renew-past" : undefined}>{renew.text}</span></> : null}
              {sub.is_active ? "" : " · turned off"}
            </p>
            {sub.url ? <p className="small-text"><a href={sub.url} target="_blank" rel="noopener noreferrer">{sub.url.replace(/^https:\/\//, "")}</a></p> : null}
          </div>
          {canManage && !sub.is_active ? (
            <form action={setSubscriptionActiveAction}>
              <input type="hidden" name="subscription_id" value={sub.id} />
              <input type="hidden" name="active" value="1" />
              <SubmitButton className="secondary" pendingText="Turning on…">Turn on</SubmitButton>
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
              <SubmitButton className="secondary" pendingText="Adding…">Add</SubmitButton>
            </form>
          ) : null}
        </section>

        {canManage ? (
          <section className="panel stack" aria-labelledby="details-title">
            <h2 id="details-title">Details</h2>
            <form action={updateSubscriptionAction} className="stack">
              <input type="hidden" name="subscription_id" value={sub.id} />
              <SubscriptionFields value={sub} />
              <div><SubmitButton className="secondary" pendingText="Saving…">Save</SubmitButton></div>
            </form>
          </section>
        ) : null}
        {canManage && sub.is_active ? (
          <section className="stack remove-zone" aria-labelledby="off-title">
            <h2 id="off-title">Turn off</h2>
            <div className="row">
              <p className="muted">When the company stops paying for {sub.name}. It leaves everyone&apos;s Home; this page and its list stay.</p>
              <ConfirmAction action={setSubscriptionActiveAction} fields={{ subscription_id: sub.id, active: "0" }} trigger={`Turn off ${sub.name}`}
                title={`Turn off ${sub.name}?`} confirm="Turn off" pending="Turning off…"
                body={`${sub.name} leaves the Home page of everyone on it. Who may use it stays listed here, and you can turn it on again.`} />
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
