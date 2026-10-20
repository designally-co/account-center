import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { getTeam } from "@/lib/teams";
import { setTeamActiveAction, setTeamRoleAction, updateTeamAction } from "../actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Messages come from this fixed list only; nothing from the address bar is shown as typed.
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "team-added": { tone: "ok", text: "Team added. Choose its default access below, then put people in it from their own page." },
  "details-saved": { tone: "ok", text: "Saved." },
  "default-saved": { tone: "ok", text: "Default access saved. Every member gets it, unless they have their own access in that app." },
  "turned-on": { tone: "ok", text: "Turned on. Its members get the team's default access again." },
  "turned-off": { tone: "ok", text: "Turned off. Its members keep only the access set for them personally." },
  "invalid-name": { tone: "error", text: "Not saved: give the team a name of up to 60 characters." },
  taken: { tone: "error", text: "Not saved: another team already has that name." },
  "unknown-role": { tone: "error", text: "That role does not exist for this app. Reload the page and try again." },
  "not-found": { tone: "error", text: "That team was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [team, canManage] = await Promise.all([getTeam(sql, id), canUser(sql, userId, ACTIONS.manage)]);
  if (!team) notFound();
  const key = typeof search.notice === "string" ? search.notice : "";
  const notice = Object.hasOwn(NOTICES, key) ? NOTICES[key] : null;
  const leads = team.members.filter((m) => m.is_lead);

  return (
    <>
      <Nav current="teams" me={me} canView />
      <main className="wide">
        <p><Link href="/teams" className="back">← Teams</Link></p>
        <div className="top">
          <div>
            <h1>{team.name}</h1>
            <p className="muted">
              {team.members.length} {team.members.length === 1 ? "member" : "members"}
              {leads.length ? ` · led by ${leads.map((l) => l.display_name).join(", ")}` : " · no lead"}
              {team.is_active ? "" : " · turned off"}
            </p>
          </div>
          {canManage ? (
            <form action={setTeamActiveAction}>
              <input type="hidden" name="team_id" value={team.id} />
              <input type="hidden" name="active" value={team.is_active ? "0" : "1"} />
              <button type="submit" className="secondary">{team.is_active ? "Turn off" : "Turn on"}</button>
            </form>
          ) : null}
        </div>

        {notice ? (notice.tone === "ok" ? <Toast text={notice.text} /> : <p className="notice error" role="alert">{notice.text}</p>) : null}
        {!canManage ? <p className="notice">View only</p> : null}

        <section className="panel stack" aria-labelledby="defaults-title">
          <div>
            <h2 id="defaults-title">Default access</h2>
            <p className="muted small-text">Every member gets this role in the app, unless an admin set their own access there. Account Center itself is never given by a team.</p>
          </div>
          <div className="team-defaults">
            {team.defaults.map((d) => (
              <form key={d.app_key} id={`app-${d.app_key}`} action={setTeamRoleAction} className="detail-row">
                <input type="hidden" name="team_id" value={team.id} />
                <input type="hidden" name="app" value={d.app_key} />
                <label htmlFor={`role-${d.app_key}`} className="detail-label">{d.app_name}</label>
                <span className="row">
                  <select id={`role-${d.app_key}`} name="role" defaultValue={d.role_key ?? ""} disabled={!canManage}>
                    <option value="">No default</option>
                    {d.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </select>
                  {canManage ? <button type="submit" className="secondary small">Save</button> : null}
                </span>
              </form>
            ))}
          </div>
        </section>

        <section className="stack" aria-labelledby="members-title">
          <h2 id="members-title">Members</h2>
          <p className="muted small-text">To add someone, or move them here from another team, open their page and choose this team.</p>
          {team.members.length === 0 ? <p className="empty">No active members.</p> : (
            <ul className="team-members">
              {team.members.map((m) => (
                <li key={m.id}>
                  <Link href={`/people/${m.id}`}>
                    <Avatar avatar={m.avatar} seed={m.id} size={36} />
                    <span>{m.display_name}</span>
                  </Link>
                  {m.is_lead ? <span className="pill plain">Lead</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage ? (
          <section className="panel stack" aria-labelledby="details-title">
            <h2 id="details-title">Name and description</h2>
            <form action={updateTeamAction} className="stack">
              <input type="hidden" name="team_id" value={team.id} />
              <label className="field">Name <input name="name" required maxLength={60} defaultValue={team.name} /></label>
              <label className="field">Short description (optional) <input name="description" maxLength={160} defaultValue={team.description} /></label>
              <div><button type="submit" className="secondary">Save</button></div>
            </form>
          </section>
        ) : null}
      </main>
    </>
  );
}
