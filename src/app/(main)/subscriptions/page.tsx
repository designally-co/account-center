import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requirePerson } from "@/lib/session";
import { listSubscriptions } from "@/lib/subscriptions";
import { createSubscriptionAction } from "./actions";
import { SubscriptionFields, renewText } from "./fields";
import { SUBSCRIPTION_NOTICES } from "./notices";
import { FormDialog } from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Shared subscriptions (Buk, 2026-10-26): tools several people use with one shared company login.
// Every company person may open it and see the tools and who uses them (Buk, 2026-11-03: "only admin can see
// the settings for team and subscriptions, members can see the overall view"). Only an admin, who may manage
// Account Center, opens a tool's settings, sees tools that are turned off and the people who left.
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId } = await requirePerson();
  const sql = db();
  const [all, canManage, search] = await Promise.all([listSubscriptions(sql), canUser(sql, userId, ACTIONS.manage), searchParams]);
  const subs = canManage ? all : all.filter((s) => s.is_active).map((s) => ({ ...s, members: s.members.filter((m) => m.is_active) }));
  const key = typeof search.notice === "string" ? search.notice : "";
  const notice = Object.hasOwn(SUBSCRIPTION_NOTICES, key) ? SUBSCRIPTION_NOTICES[key] : null;
  // Errors about the new subscription's details are shown inside its dialog, which opens again by itself.
  const formError = notice?.tone === "error" && (key.startsWith("invalid-") || key === "taken");

  return (
    <>
      <main className="wide">
        <div className="top">
          <div>
            <h1>Shared subscriptions</h1>
            <p className="muted">{canManage
              ? "Tools the company pays for, used by several people with one shared login. Who may use each one. Never the password."
              : "Tools the company pays for, used by several people with one shared login, and who uses each one."}</p>
          </div>
          {canManage ? (
            <FormDialog trigger="Add subscription" title="Add subscription" open={formError}>
              {formError && notice ? <p className="notice error" role="alert">{notice.text}</p> : null}
              <form action={createSubscriptionAction} className="stack">
                <SubscriptionFields />
                <div className="row modal-actions"><SubmitButton pendingText="Adding…">Add subscription</SubmitButton></div>
              </form>
            </FormDialog>
          ) : null}
        </div>

        {notice && !formError ? (notice.tone === "ok" ? <Toast text={notice.text} /> : <p className="notice error" role="alert">{notice.text}</p>) : null}

        {subs.length === 0 ? <p className="empty">No shared subscriptions yet.</p> : (
          <ul className="team-cards" aria-label="Shared subscriptions">
            {subs.map((s, i) => {
              const people = s.members.filter((m) => m.is_active);
              const left = s.members.length - people.length;
              const renew = renewText(s.renews_on);
              return (
                <li key={s.id} className={`team-card${s.is_active ? "" : " faded"}`} style={{ "--i": i } as React.CSSProperties}>
                  <div className="team-card-head">
                    {canManage ? <Link href={`/subscriptions/${s.id}`} className="team-card-name">{s.name}</Link> : <strong className="team-card-title">{s.name}</strong>}
                    {s.is_active ? null : <span className="pill muted">Turned off</span>}
                  </div>
                  <p className="small-text">{s.shared_email}</p>
                  {s.plan || renew ? (
                    <p className="small-text muted">
                      {s.plan}{s.plan && renew ? " · " : ""}{renew ? <span className={renew.tone === "soon" ? "renew-soon" : renew.tone === "past" ? "renew-past" : undefined}>{renew.text}</span> : null}
                    </p>
                  ) : null}
                  <div className="team-card-avatars" aria-label={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
                    {people.slice(0, 8).map((m) => (
                      <span key={m.id} title={m.display_name}><Avatar avatar={m.avatar} seed={m.id} size={32} /></span>
                    ))}
                    {people.length > 8 ? <span className="more">+{people.length - 8}</span> : null}
                    {people.length === 0 ? <span className="muted small-text">Nobody yet</span> : null}
                  </div>
                  {left && canManage ? <p><span className="pill warn">{left} {left === 1 ? "person" : "people"} left: change the password</span></p> : null}
                </li>
              );
            })}
          </ul>
        )}

      </main>
    </>
  );
}
