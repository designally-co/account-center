import Link from "next/link";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { listTeams } from "@/lib/teams";
import { createTeamAction } from "./actions";

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
  const [teams, canManage, search] = await Promise.all([listTeams(sql), canUser(sql, userId, ACTIONS.manage), searchParams]);
  const key = typeof search.notice === "string" ? search.notice : "";
  const notice = Object.hasOwn(NOTICES, key) ? NOTICES[key] : null;

  return (
    <>
      <Nav current="teams" me={me} canView />
      <main className="wide">
        <div className="top">
          <div>
            <h1>Teams</h1>
            <p className="muted">Each person is in one team. A team gives its members a default role in each app; you can still change it person by person.</p>
          </div>
        </div>

        {notice ? (notice.tone === "ok" ? <Toast text={notice.text} /> : <p className="notice error" role="alert">{notice.text}</p>) : null}

        {teams.length === 0 ? <p className="empty">No teams yet.</p> : (
          <ul className="team-cards" aria-label="Teams">
            {teams.map((t) => (
              <li key={t.id} className={`team-card${t.is_active ? "" : " faded"}`}>
                <div className="team-card-head">
                  <Link href={`/teams/${t.id}`} className="team-card-name">{t.name}</Link>
                  {t.is_active ? null : <span className="pill muted">Turned off</span>}
                </div>
                {t.description ? <p className="muted small-text">{t.description}</p> : null}
                <div className="team-card-avatars" aria-label={`${t.members.length} ${t.members.length === 1 ? "member" : "members"}`}>
                  {t.members.slice(0, 8).map((m) => (
                    <span key={m.id} title={`${m.display_name}${m.is_lead ? " (lead)" : ""}`} className={m.is_lead ? "lead" : undefined}>
                      <Avatar avatar={m.avatar} seed={m.id} size={32} />
                    </span>
                  ))}
                  {t.members.length > 8 ? <span className="more">+{t.members.length - 8}</span> : null}
                  {t.members.length === 0 ? <span className="muted small-text">No active members</span> : null}
                </div>
                <p className="small-text">
                  {t.defaults.length
                    ? t.defaults.map((d) => `${d.app_name}: ${d.role_name}`).join(" · ")
                    : <span className="muted">No default access yet</span>}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <section className="panel stack" aria-labelledby="new-team">
            <h2 id="new-team">New team</h2>
            <form action={createTeamAction} className="stack">
              <label className="field">Name <input name="name" required maxLength={60} /></label>
              <label className="field">Short description (optional) <input name="description" maxLength={160} /></label>
              <div><button type="submit">Add team</button></div>
            </form>
          </section>
        ) : null}
      </main>
    </>
  );
}
