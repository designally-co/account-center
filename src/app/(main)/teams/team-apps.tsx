"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { Switch } from "@/components/switch";
import type { TeamDefault } from "@/lib/teams";
import { setTeamActionNow } from "./actions";

const ERRORS: Record<string, string> = {
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
  "unknown-role": "Not saved: that action no longer exists. Reload the page.",
  "not-found": "Not saved: this team was not found. Reload the page.",
};

function summary(app: TeamDefault) {
  if (!app.actions.length) return "No actions yet";
  const on = app.actions.filter((a) => a.on).length;
  return on === 0 ? "Nothing on" : `${on} of ${app.actions.length} on`;
}

// The team's default access, app by app, as a stacked "liquid" accordion (Buk, 2026-11-03, after Morphin's
// stacked liquid accordion): closed, the apps sit together in one card; opening one pulls it away from the
// others with a gap above and below, its corners round off and the card it left rounds off too; closing it
// melts them back together. It is one list whose gaps, corners and open height move with CSS, so opening,
// closing and going straight from one app to another are one smooth move with nothing to overlap.
// In the open app: one plain on/off switch per action (Buk, 2026-11-03: no ready roles). Every switch saves at once.
export function TeamApps({ teamId, teamName, apps: fromServer, open, onOpen }: {
  teamId: string; teamName: string; apps: TeamDefault[]; open: string | null; onOpen: (key: string | null) => void;
}) {
  const router = useRouter();
  const [apps, setApps] = useState(fromServer);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const baseId = useId();
  // A save comes back with fresh data from the server; it replaces what the switches showed meanwhile.
  useEffect(() => { setApps(fromServer); }, [fromServer]);

  const setAction = (app: TeamDefault, key: string, on: boolean) => {
    setError(null);
    setApps((all) => all.map((a) => a.app_key !== app.app_key ? a : { ...a, actions: a.actions.map((x) => (x.key === key ? { ...x, on } : x)) }));
    startTransition(async () => {
      const result = await setTeamActionNow(teamId, app.app_key, key, on);
      if (result === "saved") return;
      setError(ERRORS[result] ?? "Not saved. Reload the page and try again.");
      setApps(fromServer);
      router.refresh();
    });
  };

  return (
    <section className="team-apps" aria-label={`Default access for ${teamName}`} data-grow-follow>
      {error ? <p className="stack-card notice error" role="alert">{error}</p> : null}
      {apps.length === 0 ? (
        <p className="stack-card liquid-empty">No apps on this team&apos;s list yet. Add one from the … menu.</p>
      ) : (
        <div className="liquid">
          {apps.map((app, i) => {
            const isOpen = app.app_key === open;
            const top = i === 0 || isOpen || apps[i - 1].app_key === open;
            const bottom = i === apps.length - 1 || isOpen || apps[i + 1]?.app_key === open;
            const panel = `${baseId}-${app.app_key}`;
            return (
              <div key={app.app_key} className={`liquid-item${isOpen ? " open" : ""}${top ? " round-top" : ""}${bottom ? " round-bottom" : ""}`}>
                <button type="button" className="liquid-head" aria-expanded={isOpen} aria-controls={panel}
                  onClick={() => onOpen(isOpen ? null : app.app_key)}>
                  <AppIcon appKey={app.app_key} name={app.app_name} icon={app.icon} hue={app.hue} size={30} />
                  <span className="liquid-name">
                    <strong>{app.app_name}</strong>
                    <span className="liquid-summary">{summary(app)}</span>
                  </span>
                  <span className="liquid-chevron" aria-hidden="true"><ChevronDown size={16} strokeWidth={1.8} /></span>
                </button>
                {/* Always in the page, so its height can open smoothly; closed, it cannot be reached. */}
                <div id={panel} className="liquid-body" role="region" aria-label={`${app.app_name}: default access`} inert={!isOpen}>
                  <div className="liquid-clip">
                    <div className="liquid-inner">
                      <p className="liquid-hint">Everyone in {teamName} gets what is on, unless a person has their own setting in {app.app_name}.</p>
                      {app.actions.length === 0 ? (
                        <p className="liquid-hint">{app.app_name} has no actions yet. They show here once the app lists them.</p>
                      ) : (
                        <ul className="liquid-actions">
                          {app.actions.map((a) => (
                            <li key={a.key}>
                              <span className="liquid-action-text" id={`${panel}-${a.key}`}>{a.description || a.key}</span>
                              <Switch on={a.on} label={a.description || a.key} onChange={(on) => setAction(app, a.key, on)} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
