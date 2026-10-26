import type { AppAccess, PersonAccess } from "@/lib/access-lists";
import { AppPanel } from "./access-form";
import { saveAppAccessAction } from "./actions";

// Shared by a person's page and each app's access page.

export type Notice = { tone: "ok" | "error"; text: string };

// Messages come from these fixed lists only; nothing from the address bar is shown as typed.
// App messages show inside the app that was saved; Kind and work emails show their own answers.

export const APP_NOTICES: Record<string, Notice> = {
  saved: { tone: "ok", text: "Saved." },
  "role-only": { tone: "ok", text: "Role saved. Check the actions below and save again if needed." },
  "kept-out": { tone: "error", text: "Not saved: this person's employment type can never use this app." },
  "manage-needs-view": { tone: "error", text: "Not saved: someone who can manage Account Center must also be able to see it." },
  changed: { tone: "error", text: "Not saved: someone changed this access after you opened the page. Check it again below, then save." },
  yourself: { tone: "error", text: "You cannot change your own Account Center access. Ask another admin." },
  "unknown-role": { tone: "error", text: "That role does not exist for this app. Reload the page and try again." },
  "unknown-app": { tone: "error", text: "That app was not found. Reload the page and try again." },
};

// Only the lists' own keys count ("constructor" or "toString" in the address must find nothing).
export function pick<T>(list: Record<string, T>, key: string): T | null {
  return Object.hasOwn(list, key) ? list[key] : null;
}

// Messages that can come from either kind of form.
export const SHARED_NOTICES: Record<string, Notice> = {
  inactive: { tone: "error", text: "This person was removed. Their access cannot be changed." },
  "not-found": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
  "remove-not-found": { tone: "error", text: "This person was already removed." },
  "remove-yourself": { tone: "error", text: "You cannot remove yourself. Ask another admin." },
  "remove-not-allowed": { tone: "error", text: "Not removed: you can no longer manage Account Center. Ask another admin." },
};

export function AppSection({ person, app, kindLabel, canManage, isMe, open, notice, standalone = false }: {
  person: PersonAccess; app: AppAccess; kindLabel: string; canManage: boolean; isMe: boolean; open: boolean; notice: Notice | null; standalone?: boolean;
}) {
  const own = isMe && app.key === "account_center";
  return (
    <AppPanel
      save={saveAppAccessAction}
      personId={person.id}
      appKey={app.key}
      appName={app.name}
      isPrototype={app.isPrototype}
      hue={app.hue}
      icon={app.icon}
      version={app.version}
      roles={app.roles.map(({ key, name, actions }) => ({ key, name, actions }))}
      actions={app.actions.map(({ key, description, on }) => ({ key, description, on: on && !app.keptOut }))}
      currentRole={app.baseKey}
      locked={!canManage || !person.is_active || own || app.allByAdmin}
      lockedNote={app.allByAdmin ? "Account Center admins have every action in every app." : own && canManage ? "Ask another admin to change your own access." : null}
      fixedNote={app.allByAdmin ? "Admin: all access" : null}
      keptOut={app.keptOut ? `Never for ${kindLabel}` : null}
      leftover={app.keptOut && (app.roleKeys.length > 0 || app.actions.some((a) => a.exception !== null))}
      initiallyOpen={open}
      standalone={standalone}
      notice={notice}
    />
  );
}

