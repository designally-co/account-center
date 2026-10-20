// The Teams screens' data code against the real schema `account`, as Account Center's own user.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPersonAccess } from "../../src/lib/access-lists";
import { listPeople } from "../../src/lib/people";
import { activeTeams, createTeam, getTeam, listTeams, setPersonTeam, setTeamActive, setTeamRole, updateTeam } from "../../src/lib/teams";
import { ANN, createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: postgres.Sql;
let deeId: string; // the admin who makes the changes
let annId: string;
let catId: string;
let branding: string;
let digital: string;

const canAnn = async (action: string) => {
  const [row] = await db.setup<{ ok: boolean }[]>`select account.can_user(${ANN}::uuid, ${action}) as ok`;
  return row.ok;
};

beforeAll(async () => {
  db = await createTestDb("account_center_teams_test");
  await db.setup`select account.import_from_hr()`;
  deeId = await db.addAdmin();
  app = db.app;
  const people = await listPeople(app);
  annId = people.find((p) => p.display_name === "Ann")!.id;
  catId = people.find((p) => p.display_name === "Cat")!.id;
  const teams = await listTeams(app);
  branding = teams.find((t) => t.name === "Branding")!.id;
  digital = teams.find((t) => t.name === "Digital")!.id;
});

afterAll(async () => { await db?.close(); });

describe("Teams", () => {
  it("lists the teams copied from HR, with active members only and their leads", async () => {
    const teams = await listTeams(app);
    expect(teams.map((t) => t.name)).toEqual(["Branding", "Digital"]);
    const b = teams.find((t) => t.id === branding)!;
    expect(b.members.map((m) => [m.display_name, m.is_lead])).toEqual([["Ann", true]]);  // Cat left, so she is not shown
    expect(b.defaults).toEqual([]);
  });

  it("shows a person's team on their page", async () => {
    const ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: branding, name: "Branding", is_active: true, is_lead: true });
  });

  it("gives every member the team's default role, and never Account Center", async () => {
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    expect(await setTeamRole(app, deeId, branding, "brand", "editor")).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(true);
    expect(await canAnn("brand.brand.delete")).toBe(false);  // an editor never deletes a brand
    expect(await setTeamRole(app, deeId, branding, "account_center", "admin")).toBe("unknown-role");
    expect(await setTeamRole(app, deeId, branding, "brand", "no-such-role")).toBe("unknown-role");
    const team = await getTeam(app, branding);
    expect(team!.defaults.find((d) => d.app_key === "brand")!.role_key).toBe("editor");
    expect(team!.defaults.some((d) => d.app_key === "account_center")).toBe(false);
  });

  it("a team that is turned off gives nothing, and nobody can be moved into it", async () => {
    expect(await setTeamActive(app, deeId, branding, false)).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    expect((await activeTeams(app)).map((t) => t.name)).toEqual(["Digital"]);
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("unknown-team");
    expect(await setTeamActive(app, deeId, branding, true)).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(true);
  });

  it("moves a person to another team: the old team's default goes, and they stop leading", async () => {
    expect(await setPersonTeam(app, deeId, annId, digital, false)).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    const ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: digital, is_lead: false });
    expect((await getTeam(app, branding))!.members).toEqual([]);
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.team).toMatchObject({ id: branding, is_lead: true });
    expect(await setPersonTeam(app, deeId, annId, null)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.team).toBeNull();
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("saved");
  });

  it("refuses a removed person, bad names, a taken name and someone who is not an admin", async () => {
    expect(await setPersonTeam(app, deeId, catId, digital)).toBe("inactive");
    expect((await createTeam(app, deeId, { name: "  ", description: "" })).result).toBe("invalid-name");
    expect((await createTeam(app, deeId, { name: "branding", description: "" })).result).toBe("taken");
    expect(await updateTeam(app, deeId, digital, { name: "Branding", description: "" })).toBe("taken");
    expect(await setTeamRole(app, annId, branding, "brand", "owner")).toBe("not-allowed");
    expect(await setPersonTeam(app, annId, annId, digital)).toBe("not-allowed");
  });

  it("adds a team, renames it, and logs who did it", async () => {
    const made = await createTeam(app, deeId, { name: " Website   team ", description: " Sites and MA " });
    expect(made.result).toBe("added");
    const id = (made as { id: string }).id;
    expect(await updateTeam(app, deeId, id, { name: "Website", description: "Sites and MA work" })).toBe("saved");
    const team = await getTeam(app, id);
    expect(team).toMatchObject({ name: "Website", description: "Sites and MA work", is_active: true, members: [] });
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name = 'teams'`;
    expect(log.n).toBeGreaterThanOrEqual(2);
  });
});
