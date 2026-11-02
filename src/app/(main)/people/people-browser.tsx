"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { PersonRow } from "@/lib/people";

type Show = "active" | "removed" | "all";

function Status({ p }: { p: PersonRow }) {
  if (!p.is_active) return <span className="pill muted">Removed</span>;
  if (p.login === "blocked") return <span className="pill warn">Login blocked</span>;
  if (p.login === "missing") return <span className="pill warn">No login</span>;
  if (p.login === "invited") return <span className="pill">Invited</span>;
  return <span className="pill ok">Active</span>;
}

// Words a person can be found by: name, sign-in email, work emails and team.
function words(p: PersonRow) {
  return [p.display_name, p.email, p.team ?? "", ...p.work_emails].join(" ").toLowerCase();
}

// Find someone fast (Buk, 2026-11-02: think about how the admin uses it): type to filter, "/" jumps to the
// box, and people who were removed are one click away instead of mixed in with everyone else.
export function PeopleBrowser({ people, view }: { people: PersonRow[]; view: "grid" | "list" }) {
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
          {shown.map((p, i) => (
            <li key={p.id} className={`person-card${p.is_active ? "" : " faded"}`} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <Avatar avatar={p.avatar} seed={p.id} size={56} />
              <div className="person-card-text">
                <Link href={`/people/${p.id}`} className="person-card-name">{p.display_name}</Link>
                <span className="person-card-email">{p.email}</span>
              </div>
              <div className="person-card-meta">
                <Status p={p} />
                <span>{p.team ? `${p.team}${p.is_lead ? " · lead" : ""}` : "No team"}</span>
                <span>{p.app_count} {p.app_count === 1 ? "app" : "apps"}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Team</th><th>Work emails</th><th>Employment</th><th>Status</th><th>Apps</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.is_active ? undefined : "faded"}>
                  <td className="name"><Link href={`/people/${p.id}`}><Avatar avatar={p.avatar} seed={p.id} size={36} /><span>{p.display_name}</span></Link></td>
                  <td>{p.email}</td>
                  <td>{p.team ? <>{p.team}{p.is_lead ? <span className="pill plain">Lead</span> : null}</> : <span className="muted">No team</span>}</td>
                  <td>
                    {p.work_emails.length ? (
                      <div className="chips">{p.work_emails.map((e) => <span key={e} className="chip">{e}</span>)}</div>
                    ) : <span className="muted">None</span>}
                  </td>
                  <td>{p.kind}</td>
                  <td><Status p={p} /></td>
                  <td className="num"><Link href={`/people/${p.id}`} aria-label={`${p.app_count} ${p.app_count === 1 ? "app" : "apps"}: access list of ${p.display_name}`}>{p.app_count}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
