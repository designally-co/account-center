// The Teams screens' data code against the real schema `account`, as Account Center's own user.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPersonAccess } from "../../src/lib/access-lists";
import { listPeople } from "../../src/lib/people";
import { activeTeams, addTeamApp, addToTeam, removeTeamApp, createTeam, deleteTeam, getTeam, listTeams, setExtraTeams, setPersonTeam, setTeamAction, setTeamRole, takeOffTeam, updateTeam } from "../../src/lib/teams";
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

// The app has no way to turn a team off (Buk, 2026-11-03), but the database still knows a team that is off,
// as a safety net. These tests switch it in the database directly.
const setActive = async (teamId: string, on: boolean) => { await db.setup`update account.teams set is_active = ${on} where id = ${teamId}::uuid`; };

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
    const brandDefaults = team!.defaults.find((d) => d.app_key === "brand")!;
    expect(brandDefaults.actions.find((a) => a.key === "brand.guideline.edit")!.on).toBe(true);
    expect(brandDefaults.actions.find((a) => a.key === "brand.brand.delete")!.on).toBe(false);
    expect(team!.choices.find((c) => c.key === "brand")!.on_list).toBe(true);
    expect(team!.choices.some((c) => c.key === "account_center")).toBe(false);
    expect(team!.defaults.some((d) => d.app_key === "account_center")).toBe(false);
  });

  it("a team that is off in the database gives nothing, and nobody can be moved into it", async () => {
    await setActive(branding, false);
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    expect((await activeTeams(app)).map((t) => t.name)).toEqual(["Digital"]);
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("unknown-team");
    await setActive(branding, true);
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

  it("a team popup's ticks: someone in another team gets it as an extra team; taking off only removes that team", async () => {
    // Ann leads Branding, her primary team. Ticking her again on Branding changes nothing.
    expect(await addToTeam(app, deeId, annId, branding)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.team).toMatchObject({ id: branding, is_lead: true });
    // Ticking her on Digital adds Digital as an extra team; Branding stays her primary team, and she still leads it.
    expect(await addToTeam(app, deeId, annId, digital)).toBe("saved");
    let ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: branding, is_lead: true });
    expect(ann!.extra_teams).toEqual([{ id: digital, name: "Digital" }]);
    const row = (await listPeople(app)).find((p) => p.id === annId)!;
    expect(row).toMatchObject({ team: "Branding", is_lead: true, extra_teams: ["Digital"] });
    // Unticking her on Branding, her primary team: Digital becomes her primary team.
    expect(await takeOffTeam(app, deeId, annId, branding)).toBe("saved");
    ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: digital, is_lead: false });
    expect(ann!.extra_teams).toEqual([]);
    // Unticking her on Digital: no team. Ticking someone with no team makes it their primary team.
    expect(await takeOffTeam(app, deeId, annId, digital)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.team).toBeNull();
    expect(await addToTeam(app, deeId, annId, digital)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.team).toMatchObject({ id: digital });
    // Refused: a removed person, a team that is off, and someone who is not an admin.
    expect(await addToTeam(app, deeId, catId, digital)).toBe("inactive");
    await setActive(branding, false);
    expect(await addToTeam(app, deeId, annId, branding)).toBe("unknown-team");
    await setActive(branding, true);
    expect(await addToTeam(app, annId, annId, branding)).toBe("not-allowed");
    expect(await takeOffTeam(app, annId, annId, digital)).toBe("not-allowed");
    // Put her back as Branding's lead, in no other team, for the tests below.
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.extra_teams).toEqual([]);
  });

  it("extra teams on a person's page: every team gives its default access, the bigger role wins", async () => {
    // Branding gives Brand Portal editor (set above); Digital gives viewer.
    expect(await setTeamRole(app, deeId, digital, "brand", "viewer")).toBe("saved");
    expect(await setPersonTeam(app, deeId, annId, digital, false)).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    expect(await setExtraTeams(app, deeId, annId, [branding, digital])).toBe("saved");  // her primary team is left out
    let ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: digital });
    expect(ann!.extra_teams).toEqual([{ id: branding, name: "Branding" }]);
    expect(await canAnn("brand.guideline.edit")).toBe(true);
    // The person's page names the biggest team role, with every action the database gives.
    const brand = ann!.apps.find((a) => a.key === "brand")!;
    expect(brand.roles[0].name).toBe("Editor (Branding default)");
    expect(brand.actions.find((a) => a.key === "brand.guideline.edit")!.on).toBe(true);
    // Choosing an extra team as the primary team: it becomes the primary one, and the old primary team is left.
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("saved");
    ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: branding, is_lead: true });
    expect(ann!.extra_teams).toEqual([]);
    // Unticking every extra team, and "No team", which leaves every team.
    expect(await setExtraTeams(app, deeId, annId, [digital])).toBe("saved");
    expect(await setExtraTeams(app, deeId, annId, [])).toBe("saved");
    expect((await getPersonAccess(app, annId))!.extra_teams).toEqual([]);
    expect(await setExtraTeams(app, deeId, annId, [digital])).toBe("saved");
    expect(await setPersonTeam(app, deeId, annId, null)).toBe("saved");
    ann = await getPersonAccess(app, annId);
    expect(ann!.team).toBeNull();
    expect(ann!.extra_teams).toEqual([]);
    // Refused: extra teams without a primary team, an unknown team, a removed person, someone who is not an admin.
    expect(await setExtraTeams(app, deeId, annId, [digital])).toBe("no-primary");
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("saved");
    expect(await setExtraTeams(app, deeId, annId, ["00000000-0000-0000-0000-000000000000"])).toBe("unknown-team");
    expect(await setExtraTeams(app, deeId, catId, [digital])).toBe("inactive");
    expect(await setExtraTeams(app, annId, annId, [digital])).toBe("not-allowed");
    expect(await setTeamRole(app, deeId, digital, "brand", null)).toBe("saved");
  });

  it("a team's single changes: block or allow one action on top of its role, shown on the person's page", async () => {
    // Ann is in Branding only; Branding gives Brand Portal editor.
    expect(await canAnn("brand.guideline.edit")).toBe(true);
    expect(await setTeamAction(app, deeId, branding, "brand", "brand.guideline.edit", false)).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    expect(await canAnn("brand.view")).toBe(true);
    let team = await getTeam(app, branding);
    let brand = team!.defaults.find((d) => d.app_key === "brand")!;
    expect(brand.actions.find((a) => a.key === "brand.guideline.edit")!.on).toBe(false);
    expect(brand.actions.find((a) => a.key === "brand.view")!.on).toBe(true);
    expect(brand.actions.some((a) => a.key === "brand.brand.delete")).toBe(true);
    let ann = await getPersonAccess(app, annId);
    let row = ann!.apps.find((a) => a.key === "brand")!;
    expect(row.roles[0].name).toBe("Editor + changes (Branding default)");
    expect(row.actions.find((a) => a.key === "brand.guideline.edit")!.on).toBe(false);
    // Allowing it again is what the role gives: the single change goes.
    expect(await setTeamAction(app, deeId, branding, "brand", "brand.guideline.edit", true)).toBe("saved");
    expect((await getTeam(app, branding))!.defaults.find((d) => d.app_key === "brand")!.actions.find((a) => a.key === "brand.guideline.edit")!.on).toBe(true);
    expect(await app`select count(*)::int as n from account.team_actions where team_id = ${branding}::uuid`.then((r) => r[0].n)).toBe(0);
    // An action the role does not give, allowed for the whole team.
    expect(await canAnn("brand.brand.delete")).toBe(false);
    expect(await setTeamAction(app, deeId, branding, "brand", "brand.brand.delete", true)).toBe("saved");
    expect(await canAnn("brand.brand.delete")).toBe(true);
    // Choosing a role again starts from that role.
    expect(await setTeamRole(app, deeId, branding, "brand", "editor")).toBe("saved");
    team = await getTeam(app, branding);
    brand = team!.defaults.find((d) => d.app_key === "brand")!;
    expect(brand.actions.find((a) => a.key === "brand.brand.delete")!.on).toBe(false);
    expect(await canAnn("brand.brand.delete")).toBe(false);
    // Single actions with no role: the person's page names it.
    expect(await setTeamRole(app, deeId, branding, "brand", null)).toBe("saved");
    expect(await setTeamAction(app, deeId, branding, "brand", "brand.view", true)).toBe("saved");
    ann = await getPersonAccess(app, annId);
    row = ann!.apps.find((a) => a.key === "brand")!;
    expect(row.roles[0].name).toBe("Single actions (Branding default)");
    expect(row.actions.filter((a) => a.on).map((a) => a.key)).toEqual(["brand.view"]);
    // Refused: Account Center, an unknown action, someone who is not an admin.
    expect(await setTeamAction(app, deeId, branding, "account_center", "account_center.view", true)).toBe("unknown-role");
    expect(await setTeamAction(app, deeId, branding, "brand", "brand.nope", true)).toBe("unknown-role");
    expect(await setTeamAction(app, annId, branding, "brand", "brand.view", false)).toBe("not-allowed");
    // Back as before: Branding gives editor.
    expect(await setTeamRole(app, deeId, branding, "brand", "editor")).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(true);
  });

  it("a team's own app list: Add app shows an app with nothing on; taking it off takes away what the team gave", async () => {
    // Branding gives Brand Portal editor here; HR is not on its list yet.
    let team = await getTeam(app, branding);
    expect(team!.defaults.some((d) => d.app_key === "hr")).toBe(false);
    expect(await addTeamApp(app, deeId, branding, "hr")).toBe("saved");
    expect(await addTeamApp(app, deeId, branding, "hr")).toBe("saved");   // twice is fine
    team = await getTeam(app, branding);
    const hr = team!.defaults.find((d) => d.app_key === "hr")!;
    expect(hr.actions.every((a) => !a.on)).toBe(true);
    expect(team!.choices.find((c) => c.key === "hr")!.on_list).toBe(true);
    // Refused: Account Center, an unknown app, someone who is not an admin.
    expect(await addTeamApp(app, deeId, branding, "account_center")).toBe("unknown-role");
    expect(await addTeamApp(app, deeId, branding, "nope")).toBe("unknown-role");
    expect(await addTeamApp(app, annId, branding, "studio")).toBe("not-allowed");
    // Taking the Brand Portal off removes what Branding gave there.
    expect(await canAnn("brand.guideline.edit")).toBe(true);
    expect(await removeTeamApp(app, deeId, branding, "brand")).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(false);
    team = await getTeam(app, branding);
    expect(team!.defaults.some((d) => d.app_key === "brand")).toBe(false);
    expect(team!.choices.find((c) => c.key === "brand")).toMatchObject({ on_list: false, gives: 0 });
    // Back as before.
    expect(await removeTeamApp(app, deeId, branding, "hr")).toBe("saved");
    expect(await setTeamRole(app, deeId, branding, "brand", "editor")).toBe("saved");
    expect(await canAnn("brand.guideline.edit")).toBe(true);
  });

  it("refuses a removed person, bad names, a taken name and someone who is not an admin", async () => {
    expect(await setPersonTeam(app, deeId, catId, digital)).toBe("inactive");
    expect((await createTeam(app, deeId, { name: "  ", description: "" })).result).toBe("invalid-name");
    expect((await createTeam(app, deeId, { name: "branding", description: "" })).result).toBe("taken");
    expect(await updateTeam(app, deeId, digital, { name: "Branding", description: "" })).toBe("taken");
    expect(await setTeamRole(app, annId, branding, "brand", "owner")).toBe("not-allowed");
    expect(await setPersonTeam(app, annId, annId, digital)).toBe("not-allowed");
  });

  it("deletes a team: its people keep their other teams, the next one becomes primary", async () => {
    const made = await createTeam(app, deeId, { name: "Short lived", description: "" });
    const temp = (made as { id: string }).id;
    // Ann leads Branding; Short lived becomes her primary team, Branding an extra one.
    expect(await addToTeam(app, deeId, annId, temp)).toBe("saved");
    expect(await setPersonTeam(app, deeId, annId, temp, false)).toBe("saved");
    expect(await addToTeam(app, deeId, annId, branding)).toBe("saved");
    expect((await getPersonAccess(app, annId))!.team).toMatchObject({ id: temp });
    expect(await setTeamRole(app, deeId, temp, "brand", "viewer")).toBe("saved");
    expect(await deleteTeam(app, annId, temp)).toBe("not-allowed");
    expect(await deleteTeam(app, deeId, temp)).toBe("saved");
    expect((await listTeams(app)).some((t) => t.id === temp)).toBe(false);
    const ann = await getPersonAccess(app, annId);
    expect(ann!.team).toMatchObject({ id: branding });
    expect(ann!.extra_teams).toEqual([]);
    expect(await deleteTeam(app, deeId, temp)).toBe("not-found");
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name = 'teams' and event = 'delete'`;
    expect(log.n).toBe(1);
    // Back as before: Ann leads Branding.
    expect(await setPersonTeam(app, deeId, annId, branding, true)).toBe("saved");
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
