import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { listTeams } from "@/lib/teams";
import { createTeamAction } from "./actions";
import { TeamMembers, type PickPerson } from "./team-members";
import { listPeople } from "@/lib/people";
import { FormDialog } from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Messages come from this fixed list only; nothing from the address bar is shown as typed.
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "invalid-name": { tone: "error", text: "Not added: give the team a name of up to 60 characters." },
  taken: { tone: "error", text: "Not added: a team with that name already exists." },
  "not-found": { tone: "error", text: "That team was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

// Teams (Buk, 2026-10-19): one team per person; a team gives its members a default role in each app.
export default async function TeamsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [teams, canManage, search, everyone] = await Promise.all([listTeams(sql), canUser(sql, userId, ACTIONS.manage), searchParams, listPeople(sql)]);
  // Who can be put in a team from its card: everyone active, with their current team (one team per person).
  const pickable: PickPerson[] = everyone.filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.display_name, team: p.team, is_lead: p.is_lead, avatar: p.avatar }));
  const key = typeof search.notice === "string" ? search.notice : "";
  const notice = Object.hasOwn(NOTICES, key) ? NOTICES[key] : null;
  // Errors about the new team's name are shown inside its dialog, which opens again by itself.
  const formError = key === "invalid-name" || key === "taken";

  return (
    <>
      <main className="wide">
        <div className="top">
          <div>
            <h1>Teams</h1>
            <p className="muted">Each person is in one team. A team gives its members a default role in each app; you can still change it person by person.</p>
          </div>
          {canManage ? (
            <FormDialog trigger="New team" title="New team" open={formError}>
              {formError && notice ? <p className="notice error" role="alert">{notice.text}</p> : null}
              <form action={createTeamAction} className="stack">
                <label className="field">Name <input name="name" required maxLength={60} autoFocus /></label>
                <label className="field">Short description (optional) <input name="description" maxLength={160} /></label>
                <div className="row modal-actions"><SubmitButton pendingText="Adding…">Add team</SubmitButton></div>
              </form>
            </FormDialog>
          ) : null}
        </div>

        {notice && !formError ? (notice.tone === "ok" ? <Toast text={notice.text} /> : <p className="notice error" role="alert">{notice.text}</p>) : null}

        {teams.length === 0 ? <p className="empty">No teams yet.</p> : (
          <ul className="team-cards" aria-label="Teams">
            {teams.map((t, i) => (
              <li key={t.id} className={`team-card${t.is_active ? "" : " faded"}`} style={{ "--i": i } as React.CSSProperties}>
                <div className="team-card-head">
                  <Link href={`/teams/${t.id}`} className="team-card-name">{t.name}</Link>
                  {t.is_active ? null : <span className="pill muted">Turned off</span>}
                </div>
                {t.description ? <p className="muted small-text">{t.description}</p> : null}
                {/* Admins add and take off members right here, on an active team's card (Buk, 2026-11-02). */}
                {canManage && t.is_active ? (
                  <TeamMembers teamId={t.id} teamName={t.name} people={pickable} members={t.members.map((m) => m.id)} />
                ) : (
                <div className="team-card-avatars" aria-label={`${t.members.length} ${t.members.length === 1 ? "member" : "members"}`}>
                  {t.members.slice(0, 8).map((m) => (
                    <span key={m.id} title={`${m.display_name}${m.is_lead ? " (lead)" : ""}`} className={m.is_lead ? "lead" : undefined}>
                      <Avatar avatar={m.avatar} seed={m.id} size={32} />
                    </span>
                  ))}
                  {t.members.length > 8 ? <span className="more">+{t.members.length - 8}</span> : null}
                  {t.members.length === 0 ? <span className="muted small-text">No active members</span> : null}
                </div>
                )}
                <p className="small-text">
                  {t.defaults.length
                    ? t.defaults.map((d) => `${d.app_name}: ${d.role_name}`).join(" · ")
                    : <span className="muted">No default access yet</span>}
                </p>
              </li>
            ))}
          </ul>
        )}

      </main>
    </>
  );
}
