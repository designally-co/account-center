"use client";

import { closeDialog } from "@/components/motion";
import { forwardRef, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { Switch } from "@/components/switch";
import type { TeamAppChoice } from "@/lib/teams";
import { setTeamAppNow } from "./actions";

const ERRORS: Record<string, string> = {
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
  "unknown-role": "Not saved: that app no longer exists. Reload the page.",
  "not-found": "Not saved: this team no longer exists. Reload the page.",
};

// "Add app" from the team's "…" menu (Buk, 2026-11-03: "add one more action called add app so that the new app
// can be seen in the access list"; Buk chose "pick apps per team"). Every app is listed with an on/off switch
// (Buk, 2026-11-03: "add app can be toggle for each app"): on puts it on the team's list with nothing on, off
// takes it off. Turning off an app the team gives something in asks first, because what the team gives there
// goes too. Each switch saves at once.
export const TeamAppPicker = forwardRef<HTMLDialogElement, { teamId: string; teamName: string; choices: TeamAppChoice[] }>(
  function TeamAppPicker({ teamId, teamName, choices }, ref) {
    const router = useRouter();
    const titleId = useId();
    const [list, setList] = useState(choices);
    const [asking, setAsking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    useEffect(() => { setList(choices); }, [choices]);

    const toggle = (app: TeamAppChoice, on: boolean) => {
      setError(null);
      setAsking(null);
      setList((all) => all.map((a) => (a.key === app.key ? { ...a, on_list: on, gives: on ? a.gives : 0 } : a)));
      startTransition(async () => {
        const result = await setTeamAppNow(teamId, app.key, on);
        if (result !== "saved") setError(ERRORS[result] ?? "Not saved. Reload the page and try again.");
        router.refresh();
      });
    };

    const line = (a: TeamAppChoice) => !a.actions ? "No actions yet"
      : a.on_list && a.gives ? `${a.gives} of ${a.actions} actions on` : `${a.actions} ${a.actions === 1 ? "action" : "actions"}`;

    return (
      <dialog ref={ref} className="modal people-dialog" aria-labelledby={titleId}>
        <div className="stack">
          <div className="modal-head">
            <h2 id={titleId}>Apps for {teamName}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={(e) => closeDialog(e.currentTarget.closest("dialog"))}>
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <p className="muted small-text">Turn an app on to show it in the team&apos;s access, where you turn its actions on.</p>
          {error ? <p className="notice error" role="alert">{error}</p> : null}
          <ul className="people-pick" aria-label="Apps">
            {list.map((a) => (
              <li key={a.key} className={asking === a.key ? "asking" : a.on_list ? "on" : undefined}>
                <AppIcon appKey={a.key} name={a.name} icon={a.icon} hue={a.hue} size={32} />
                <span className="people-pick-text">
                  <strong>{a.name}</strong>
                  <span>{asking === a.key ? `Turn off? ${teamName} stops giving its ${a.gives} ${a.gives === 1 ? "action" : "actions"} here.` : line(a)}</span>
                </span>
                {asking === a.key ? (
                  <span className="pick-confirm">
                    <button type="button" className="secondary small" onClick={() => setAsking(null)}>Cancel</button>
                    <button type="button" className="danger small" aria-label={`Turn off ${a.name} and its access`} onClick={() => toggle(a, false)}>Turn off</button>
                  </span>
                ) : (
                  <Switch on={a.on_list} label={`${a.name} on ${teamName}'s list`}
                    onChange={(on) => (!on && a.gives > 0 ? setAsking(a.key) : toggle(a, on))} />
                )}
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    );
  });
