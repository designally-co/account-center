// The visible / hidden button's rules (no database): what turning an app on gives, and when it is locked.
import { describe, expect, it } from "vitest";
import { TEAM_ROLE, visibilityOf, visibleRoleFor, type AppAccess } from "../../src/lib/access-lists";

const app = (over: Partial<AppAccess> = {}): AppAccess => ({
  key: "brand", name: "Brand portal", description: "", isPrototype: false, hue: null, url: null, icon: null, art: null, keptOut: false,
  roles: [
    { key: "owner", name: "Owner", description: "", actions: ["brand.view", "brand.edit", "brand.delete"] },
    { key: "viewer", name: "Viewer", description: "", actions: ["brand.view"] },
    { key: "editor", name: "Editor", description: "", actions: ["brand.view", "brand.edit"] },
  ],
  roleKeys: [], team: null, baseKey: "", allByAdmin: false, version: "1",
  actions: [{ key: "brand.view", description: "", on: false, exception: null }, { key: "brand.edit", description: "", on: false, exception: null }],
  ...over,
} as AppAccess);
const active = { is_active: true };
const admin = { canManage: true, isMe: false };

describe("Visible or hidden", () => {
  it("turning on gives the app's smallest role", () => {
    expect(visibleRoleFor(app())).toEqual({ key: "viewer", name: "Viewer" });
  });
  it("turning on gives the team's default role when the team has one", () => {
    const withTeam = app({ roles: [{ key: TEAM_ROLE, name: "Editor (Branding default)", description: "", actions: ["brand.view", "brand.edit"] }, ...app().roles] });
    expect(visibleRoleFor(withTeam)).toEqual({ key: TEAM_ROLE, name: "Editor (Branding default)" });
  });
  it("is on when the person has any action", () => {
    expect(visibilityOf(app(), active, admin).on).toBe(false);
    expect(visibilityOf(app({ actions: [{ key: "brand.view", description: "", on: true, exception: null }] } as Partial<AppAccess>), active, admin).on).toBe(true);
  });
  it("is locked, with the reason, when it may not be pressed", () => {
    expect(visibilityOf(app(), active, { canManage: false, isMe: false }).locked).toBe("View only");
    expect(visibilityOf(app(), { is_active: false }, admin).locked).toBe("Removed from Account Center");
    expect(visibilityOf(app({ keptOut: true }), active, admin).locked).toBe("Never for this employment type");
    expect(visibilityOf(app({ allByAdmin: true }), active, admin).locked).toBe("Admins see every app");
    expect(visibilityOf(app({ key: "account_center" }), active, { canManage: true, isMe: true }).locked).toBe("Ask another admin");
    expect(visibilityOf(app({ roles: [] }), active, admin).locked).toBe("No actions yet");
    expect(visibilityOf(app(), active, admin).locked).toBeNull();
  });
});
