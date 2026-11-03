"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap, OUT, reducedMotion } from "@/components/motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Popup } from "@/components/popup";
import type { PersonRow } from "@/lib/people";

type Show = "active" | "removed" | "all";

function Status({ p }: { p: PersonRow }) {
  if (!p.is_active) return <span className="pill muted">Removed</span>;
  if (p.login === "blocked") return <span className="pill warn">Login blocked</span>;
  if (p.login === "missing") return <span className="pill warn">No login</span>;
  if (p.login === "invited") return <span className="pill">Invited</span>;
  return <span className="pill ok">Active</span>;
}

// On a card only what needs a look is shown: "Active" is what almost everyone is, so it is left out
// (Buk, 2026-11-03: "remove active badge as it will be noise").
function needsLook(p: PersonRow) {
  return !p.is_active || p.login !== "ok";
}

// Words a person can be found by: name, sign-in email, work emails and every team.
function words(p: PersonRow) {
  return [p.display_name, p.email, p.team ?? "", ...p.extra_teams, ...p.work_emails].join(" ").toLowerCase();
}

// While a person's details come from the server, their popup shows soft grey cards where theirs will be.
function Waiting() {
  return (
    <div className="person-detail person-waiting" aria-busy="true" aria-label="Loading" data-waiting>
      <div className="stack-card person-section" data-grow-follow>
        {[0, 1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 22, width: n === 1 ? "60%" : "80%" }} />)}
      </div>
      <div className="stack-card person-section" data-grow-follow>
        <div className="skeleton" style={{ height: 18, width: 60 }} />
        <div className="person-waiting-grid">
          {[0, 1, 2, 3].map((n) => <div key={n} className="skeleton" style={{ height: 92 }} />)}
        </div>
      </div>
    </div>
  );
}

// Find someone fast (Buk, 2026-11-02: think about how the admin uses it): type to filter, "/" jumps to the
// box, and people who were removed are one click away instead of mixed in with everyone else.
//
// Pressing a person grows their card into a popup over the list (Buk, 2026-11-03: "I want the person view to be
// like the team popup too with the transition"). The popup draws the face, the name and the status line from
// the list at once; the rest (`detail`) comes from the server for that one person, at /people?person=<id>.
// The browser's Back closes it, a link opens it, and a save inside it comes back to the same address.
export function PeopleBrowser({ people, view, detail }: {
  people: PersonRow[];
  view: "grid" | "list";
  detail: { id: string; node: React.ReactNode } | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const asked = search.get("person");
  // The person just pressed: the popup grows at once, before the server has answered.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { setPending(null); }, [asked]);
  const openId = pending ?? (asked && people.some((p) => p.id === asked) ? asked : null);
  const person = openId ? people.find((p) => p.id === openId) ?? null : null;
  const lastOpen = useRef<string | null>(null);
  if (openId) lastOpen.current = openId;
  const titleId = useId();
  const base = view === "list" ? "/people?view=list" : "/people";
  const hrefOf = (id: string) => `${base}${view === "list" ? "&" : "?"}person=${id}`;
  const open = (e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setPending(id);
    router.push(hrefOf(id), { scroll: false });
  };
  const close = () => {
    setPending(null);
    window.history.replaceState(null, "", base);
  };
  // The card came back as a new element, so it is found again by its link.
  const backToCard = () => document.querySelector<HTMLElement>(`[data-person="${lastOpen.current}"]`)?.focus();

  // When the details arrive after the grey cards, the real cards rise in one after another in their place.
  const stackRef = useRef<HTMLDivElement>(null);
  const waited = useRef<string | null>(null);
  const ready = openId !== null && detail?.id === openId;
  useLayoutEffect(() => {
    if (!openId) { waited.current = null; return; }
    if (!ready) { waited.current = openId; return; }
    if (waited.current !== openId || !stackRef.current || reducedMotion()) return;
    waited.current = null;
    const cards = stackRef.current.querySelectorAll(".person-detail > *");
    gsap.fromTo(cards, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: OUT, stagger: 0.05, clearProps: "transform,opacity" });
  }, [openId, ready]);

  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("active");
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      box.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = people.filter((p) => p.is_active).length;
  const counts: Record<Show, number> = { active, removed: people.length - active, all: people.length };
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => people.filter((p) =>
    (show === "all" || (show === "active") === p.is_active) && (!q || words(p).includes(q))), [people, show, q]);

  return (
    <>
    <div className="stack">
      <div className="people-tools">
        <label className="search">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" /><path d="M10.5 10.5 14 14" /></svg>
          <span className="sr-only">Find a person</span>
          <input ref={box} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find by name, email or team"
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} autoComplete="off" spellCheck={false} />
          {query ? null : <kbd aria-hidden="true">/</kbd>}
        </label>
        <div className="seg-tabs" role="radiogroup" aria-label="Show">
          {(["active", "removed", "all"] as const).map((s) => (
            <label key={s} className={show === s ? "on" : undefined}>
              <input type="radio" name="show" className="sr-only" checked={show === s} onChange={() => setShow(s)} />
              {s === "active" ? "Active" : s === "removed" ? "Removed" : "All"}
              <span className="seg-count">{counts[s]}</span>
            </label>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">{shown.length} {shown.length === 1 ? "person" : "people"}</p>

      {shown.length === 0 ? (
        <div className="empty stack tight">
          <p>{q ? <>No one matches &ldquo;{query.trim()}&rdquo;.</> : show === "removed" ? "Nobody has been removed." : "Nobody here yet."}</p>
          {q || show !== "active" ? (
            <p><button type="button" className="secondary small" onClick={() => { setQuery(""); setShow("active"); box.current?.focus(); }}>Show everyone active</button></p>
          ) : null}
        </div>
      ) : view === "grid" ? (
        <ul className="people-cards" aria-label="People">
          {shown.map((p, i) => {
            // A card (Buk, 2026-11-03): the face, the name and the primary team under it, "Lead" at the top
            // right when they lead that team. No email and no app count; those are in the person's popup.
            const inner = (
              <>
                {p.is_lead && p.team ? <span className="person-card-lead">Lead</span> : null}
                <Avatar avatar={p.avatar} seed={p.id} size={56} />
                <div className="person-card-text">
                  <a href={hrefOf(p.id)} className="person-card-name" data-person={p.id} aria-haspopup="dialog" onClick={(e) => open(e, p.id)}>{p.display_name}</a>
                  <span className={`person-card-team${p.team ? "" : " none"}`}>{p.team ?? "No team"}</span>
                </div>
                {needsLook(p) ? <div className="person-card-meta"><Status p={p} /></div> : null}
              </>
            );
            return (
              <li key={p.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                {/* While the person is open, the popup hides this card and grows out of it (GSAP). */}
                <div className={`person-card${p.is_active ? "" : " faded"}`} data-grow={`person-${p.id}`} inert={p.id === openId}>
                  <div className="person-card-inner" data-grow-content>{inner}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Team</th><th>Work emails</th><th>Employment</th><th>Status</th><th>Apps</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.is_active ? undefined : "faded"} data-grow={`person-${p.id}`}>
                  <td className="name"><a href={hrefOf(p.id)} data-person={p.id} aria-haspopup="dialog" onClick={(e) => open(e, p.id)}><Avatar avatar={p.avatar} seed={p.id} size={36} /><span>{p.display_name}</span></a></td>
                  <td>{p.email}</td>
                  <td>
                    {p.team ? <>{p.team}{p.is_lead ? <span className="pill plain">Lead</span> : null}</> : <span className="muted">No team</span>}
                    {p.extra_teams.length ? <div className="muted small-text">Also {p.extra_teams.join(", ")}</div> : null}
                  </td>
                  <td>
                    {p.work_emails.length ? (
                      <div className="chips">{p.work_emails.map((e) => <span key={e} className="chip">{e}</span>)}</div>
                    ) : <span className="muted">None</span>}
                  </td>
                  <td>{p.kind}</td>
                  <td>{needsLook(p) ? <Status p={p} /> : <span className="muted">Active</span>}</td>
                  <td className="num"><a href={hrefOf(p.id)} aria-haspopup="dialog" onClick={(e) => open(e, p.id)} aria-label={`${p.app_count} ${p.app_count === 1 ? "app" : "apps"}: access list of ${p.display_name}`}>{p.app_count}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

      {/* Separate cards, like a team (Buk, 2026-11-03: "separated containers not inside one big container"): the
          person's own card on top, grown out of their card on the page, then a card for each part below it. */}
      <Popup open={person !== null} growFrom={`person-${person?.id ?? lastOpen.current}`} labelledBy={titleId} onClose={close}
        afterClose={backToCard} className="person-modal" stack>
        {person ? (
          <div className="person-stack" ref={stackRef}>
            <div className="stack-card person-head-card" data-grow-target>
              <div className="person-sheet-head" data-grow-content>
                <Avatar avatar={person.avatar} seed={person.id} size={64} />
                <div className="person-sheet-words">
                  <h2 id={titleId} className="person-sheet-title">
                    {person.display_name}
                    {person.is_lead && person.team ? <span className="person-card-lead inline">Lead</span> : null}
                  </h2>
                  <p className="person-sheet-meta">
                    <span>{person.team ?? "No team"}{person.extra_teams.length ? `, also ${person.extra_teams.join(", ")}` : ""}</span>
                    <span className="person-sheet-email">{person.email}</span>
                    {needsLook(person) ? <Status p={person} /> : null}
                  </p>
                </div>
                <button type="button" className="icon-button popup-close person-sheet-close" aria-label="Close" onClick={close}>
                  <X size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>
            {detail?.id === person.id ? detail.node : <Waiting />}
          </div>
        ) : null}
      </Popup>
    </>
  );
}
