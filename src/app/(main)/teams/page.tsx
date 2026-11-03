import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requirePerson } from "@/lib/session";
import { getTeam, listTeams, type TeamDetail } from "@/lib/teams";
import { listPeople } from "@/lib/people";
import { TeamBoard } from "./team-board";
import type { PickPerson } from "./team-people";
import { createTeamAction } from "./actions";
import { FormDialog } from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Messages come from this fixed list only; nothing from the address bar is shown as typed.
// Adding a team: its errors show inside the "New team" dialog.
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "team-deleted": { tone: "ok", text: "Team deleted. Its people keep their other teams and their own access." },
  "invalid-name": { tone: "error", text: "Not added: give the team a name of up to 60 characters." },
  taken: { tone: "error", text: "Not added: a team with that name already exists." },
  "not-found": { tone: "error", text: "That team was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};
// A save inside a team's popup comes back here with ?team=<id>: its errors show inside the popup.
const TEAM_NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "team-added": { tone: "ok", text: "Team added. Add its members and choose its default access here." },
  "details-saved": { tone: "ok", text: "Saved." },
  "default-saved": { tone: "ok", text: "Default access saved. Every member gets it, unless they have their own access in that app." },
  "invalid-name": { tone: "error", text: "Not saved: give the team a name of up to 60 characters." },
  taken: { tone: "error", text: "Not saved: another team already has that name." },
  "unknown-role": { tone: "error", text: "That role does not exist for this app. Reload the page and try again." },
  "not-found": { tone: "error", text: "That team was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

// Teams (Buk, 2026-10-19): one team per person; a team gives its members a default role in each app.
// Every company person may open it and see the teams and who is in them (Buk, 2026-11-03: "only admin can see
// the settings for team and subscriptions, members can see the overall view"). The settings (default access,
// members to add or take off, the name) reach the page only for an admin, who may manage Account Center.
export default async function TeamsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId } = await requirePerson();
  const sql = db();
  const [teams, canManage, canView, search] = await Promise.all([
    listTeams(sql), canUser(sql, userId, ACTIONS.manage), canUser(sql, userId, ACTIONS.view), searchParams]);
  // Every team's popup is ready on the page, so opening one asks nothing of the server. A person's email reaches
  // the page only for someone who may view Account Center (the popup's tiles show it), and a member's page gets
  // no settings at all.
  const details: Record<string, TeamDetail> = Object.fromEntries(
    (await Promise.all(teams.map((t) => getTeam(sql, t.id)))).filter((d): d is TeamDetail => d !== null)
      .map((d) => [d.id, { ...d, members: d.members.map((m) => ({ ...m, email: canView ? m.email : "" })), defaults: canManage ? d.defaults : [] }]));
  const cards = teams.map((t) => ({ ...t, members: t.members.map((m) => ({ ...m, email: "" })), defaults: [] }));
  // Who can be put in a team: everyone active, with their primary and extra teams. Admins only.
  const pickable: PickPerson[] = canManage ? (await listPeople(sql)).filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.display_name, team: p.team, extra_teams: p.extra_teams, avatar: p.avatar })) : [];
  const key = typeof search.notice === "string" ? search.notice : "";
  const inTeam = typeof search.team === "string" && Object.hasOwn(details, search.team);
  const teamNotice = inTeam && Object.hasOwn(TEAM_NOTICES, key) ? TEAM_NOTICES[key] : null;
  const notice = !inTeam && Object.hasOwn(NOTICES, key) ? NOTICES[key] : null;
  // Errors about the new team's name are shown inside its dialog, which opens again by itself.
  const formError = !inTeam && (key === "invalid-name" || key === "taken");

  return (
    <>
      <main className="wide">
        <div className="top">
          <div>
            <h1>Teams</h1>
            <p className="muted">{canManage
              ? "Each person has a primary team and can be in more. A team gives its people a default access in each app; you can still change it person by person."
              : "Who is in each team at Designally."}</p>
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

        {teamNotice?.tone === "ok" ? <Toast text={teamNotice.text} /> : null}
        <TeamBoard teams={cards} details={details} people={pickable} canManage={canManage} canView={canView}
          error={teamNotice?.tone === "error" ? teamNotice.text : null} />
      </main>
    </>
  );
}
