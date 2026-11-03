"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check, ChevronDown } from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import type { TeamDefault } from "@/lib/teams";
import { setTeamActionNow, setTeamRoleNow } from "./actions";

// One spring for every move in the popup, so the people and the apps move as one.
export const LIQUID = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.85 };

const ERRORS: Record<string, string> = {
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
  "unknown-role": "Not saved: that role or action no longer exists. Reload the page.",
  "not-found": "Not saved: this team was not found. Reload the page.",
};

// What the team gives in one app: its single change for an action when it has one, else its role.
function isOn(app: TeamDefault, key: string) {
  if (Object.hasOwn(app.changes, key)) return app.changes[key];
  return app.roles.find((r) => r.key === app.role_key)?.actions.includes(key) ?? false;
}

function summary(app: TeamDefault) {
  const on = app.actions.filter((a) => isOn(app, a.key)).length;
  const role = app.roles.find((r) => r.key === app.role_key)?.name;
  const changed = Object.keys(app.changes).length > 0;
  if (on === 0) return "No default access";
  return `${role ?? "Single actions"}${role && changed ? " + changes" : ""} · ${on} of ${app.actions.length}`;
}

// The team's default access, app by app, as a stacked "liquid" accordion (Buk, 2026-11-03, after Morphin's
// stacked liquid accordion): closed, the apps sit in one card; opening one splits the card into three that
// slide apart (the apps above, the open app, the apps below), and closing it melts them back together. In the
// open app: the team's ready role, then one allow/block switch per action (Buk chose a ready role plus single
// changes, the same as a person's access). Every switch saves at once.
export function TeamApps({ teamId, teamName, apps: fromServer, open, onOpen }: {
  teamId: string; teamName: string; apps: TeamDefault[]; open: string | null; onOpen: (key: string | null) => void;
}) {
  const router = useRouter();
  const [apps, setApps] = useState(fromServer);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const titleId = useId();  // names each open app's panel
  // A save comes back with fresh data from the server; it replaces what the switches showed meanwhile.
  useEffect(() => { setApps(fromServer); }, [fromServer]);

  const patch = (key: string, change: (app: TeamDefault) => TeamDefault) =>
    setApps((all) => all.map((a) => (a.app_key === key ? change(a) : a)));
  const done = (result: string) => {
    if (result === "saved") return;
    setError(ERRORS[result] ?? "Not saved. Reload the page and try again.");
    setApps(fromServer);
    router.refresh();
  };
  const setAction = (app: TeamDefault, key: string, allowed: boolean) => {
    setError(null);
    const fromRole = app.roles.find((r) => r.key === app.role_key)?.actions.includes(key) ?? false;
    patch(app.app_key, (a) => {
      const changes = { ...a.changes };
      if (allowed === fromRole) delete changes[key]; else changes[key] = allowed;
      return { ...a, changes };
    });
    startTransition(async () => done(await setTeamActionNow(teamId, app.app_key, key, allowed)));
  };
  const setRole = (app: TeamDefault, role: string) => {
    setError(null);
    patch(app.app_key, (a) => ({ ...a, role_key: role || null, changes: {} }));
    startTransition(async () => done(await setTeamRoleNow(teamId, app.app_key, role || null)));
  };

  // Closed: one card. Open: the apps above, the open app, the apps below, each its own card. A card is known by
  // its first app, so the card that was there stays and the new ones come out of it.
  const at = open ? apps.findIndex((a) => a.app_key === open) : -1;
  const groups = at < 0 ? [apps] : [apps.slice(0, at), [apps[at]], apps.slice(at + 1)].filter((g) => g.length);

  if (!apps.length) return null;
  return (
    <motion.section layout="position" transition={LIQUID} className="team-apps" aria-label={`Default access for ${teamName}`}>
      {error ? <motion.p layout="position" className="stack-card notice error" role="alert">{error}</motion.p> : null}
      <AnimatePresence initial={false} mode="popLayout">
          {groups.map((group) => {
            const single = group.length === 1 && group[0].app_key === open;
            return (
              <motion.div key={group[0].app_key} layout transition={LIQUID} className={`stack-card liquid-card${single ? " open" : ""}`}
                style={{ borderRadius: 20 }} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { ...LIQUID, delay: 0.1 } }}
                exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}>
                {group.map((app) => {
                  const isOpen = app.app_key === open;
                  const panel = `${titleId}-${app.app_key}`;
                  return (
                    <motion.div key={app.app_key} layoutId={`app-${teamId}-${app.app_key}`} layout="position" transition={LIQUID} className="liquid-item">
                      <button type="button" className="liquid-head" aria-expanded={isOpen} aria-controls={panel}
                        onClick={() => onOpen(isOpen ? null : app.app_key)}>
                        <AppIcon appKey={app.app_key} name={app.app_name} icon={app.icon} hue={app.hue} size={30} />
                        <span className="liquid-name">
                          <strong>{app.app_name}</strong>
                          <span className="liquid-summary">{summary(app)}</span>
                        </span>
                        <motion.span className="liquid-chevron" animate={{ rotate: isOpen ? 180 : 0 }} transition={LIQUID} aria-hidden="true">
                          <ChevronDown size={16} strokeWidth={1.8} />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <motion.div id={panel} key="body" className="liquid-body" role="region" aria-label={`${app.app_name}: default access`}
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ height: LIQUID, opacity: { duration: 0.18 } }}>
                            <div className="liquid-inner">
                              <p className="liquid-hint">Everyone in {teamName} gets this, unless a person has their own access in {app.app_name}.</p>
                              <label className="liquid-role">
                                <span>Ready role</span>
                                <select value={app.role_key ?? ""} onChange={(e) => setRole(app, e.target.value)}>
                                  <option value="">No role (single actions only)</option>
                                  {app.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                                </select>
                              </label>
                              <ul className="liquid-actions">
                                {app.actions.map((a, i) => {
                                  const on = isOn(app, a.key);
                                  const changed = Object.hasOwn(app.changes, a.key);
                                  return (
                                    <motion.li key={a.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * Math.min(i, 10) + 0.08 } }}>
                                      <span className="liquid-action-text">
                                        {a.description || a.key}
                                        {changed ? <span className="pill plain liquid-changed">Changed</span> : null}
                                      </span>
                                      <span className="allow-switch" role="group" aria-label={a.description || a.key}>
                                        <button type="button" className={`allow-yes${on ? " on" : ""}`} aria-pressed={on} aria-label="Allow"
                                          onClick={() => { if (!on) setAction(app, a.key, true); }}>
                                          <Check size={14} strokeWidth={2.2} aria-hidden="true" />
                                        </button>
                                        <button type="button" className={`allow-no${on ? "" : " on"}`} aria-pressed={!on} aria-label="Block"
                                          onClick={() => { if (on) setAction(app, a.key, false); }}>
                                          <Ban size={14} strokeWidth={2} aria-hidden="true" />
                                        </button>
                                      </span>
                                    </motion.li>
                                  );
                                })}
                              </ul>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            );
          })}
      </AnimatePresence>
    </motion.section>
  );
}
