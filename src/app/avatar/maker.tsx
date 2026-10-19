"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SubmitButton } from "@/app/people/[id]/access-form";
import { BACKGROUNDS, BADGE_OUTFITS, PARTS, avatarDataUri, randomAvatar, type AvatarChoice, type PartKey } from "@/lib/avatar";

// Parts drawn close up in their tiles; the others show the whole figure.
const CLOSE_UP = new Set(["hair", "eyes", "brows", "lips", "nose", "glasses", "beard"]);
const ALL_TABS = [...PARTS.map((p) => ({ key: p.key, label: p.label })), { key: "background", label: "Colour" }];

function DiceIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="13" cy="13" r="1.2" fill="currentColor" />
      <circle cx="13" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="13" r="1.2" fill="currentColor" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

// Arrow keys inside a group of buttons (tabs, tiles or colours): one Tab stop for the whole group.
// Left/Right move by one, Up/Down by a row (for grids), Home/End to the ends. `pick` selects the item.
function arrowKeys(e: KeyboardEvent<HTMLElement>, pick: (index: number) => void, grid: boolean) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-item]")];
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  const perRow = grid ? Math.max(1, items.filter((el) => el.offsetTop === items[0].offsetTop).length) : 1;
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: grid ? perRow : 1, ArrowUp: grid ? -perRow : -1 };
  let next = at;
  if (e.key in step) next = Math.min(items.length - 1, Math.max(0, at + step[e.key]));
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  else return;
  e.preventDefault();
  items[next].focus();
  pick(next);
}

export function AvatarMaker({ save, later, start, welcome, name }: {
  save: (form: FormData) => Promise<void>;
  later: (form: FormData) => Promise<void>;
  start: AvatarChoice;
  welcome: boolean;
  name: string;
}) {
  const [choice, setChoice] = useState(start);
  const [tab, setTab] = useState<string>("hair");
  const [announce, setAnnounce] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const part = PARTS.find((p) => p.key === tab);
  // A badge only shows on some outfits, so its tab is there only for those.
  const tabs = ALL_TABS.filter((t) => t.key !== "bodyIcon" || BADGE_OUTFITS.has(choice.body ?? ""));
  // Choosing a part: an outfit without room for a badge drops the badge.
  const choose = (key: string, value: string | null) =>
    setChoice((c) => ({ ...c, [key]: value, ...(key === "body" && !BADGE_OUTFITS.has(value ?? "") ? { bodyIcon: null } : {}) }));

  const tiles = useMemo(() => {
    if (!part) return [];
    const focus = CLOSE_UP.has(part.key) ? "face" : "full";
    const values: (string | null)[] = part.optional ? [null, ...part.options] : part.options;
    return values.map((value, i) => ({
      value,
      label: value === null ? `No ${part.label.toLowerCase()}` : `${part.label} ${part.optional ? i : i + 1}`,
      // Close-ups leave out the hands and the badge, so the part itself is easy to see.
      src: avatarDataUri({ ...choice, ...(focus === "face" ? { gesture: null, bodyIcon: null } : {}), [part.key]: value }, focus),
    }));
  }, [choice, part]);

  // When a part opens, its chosen tile is scrolled into view inside the grid.
  useEffect(() => {
    panel.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: "nearest" });
  }, [tab]);

  const current = part ? choice[part.key as PartKey] : choice.background;
  return (
    <div className="maker">
      <div className="maker-head stack tight">
        <h1>{welcome ? `Welcome, ${name}` : "Your avatar"}</h1>
        <p className="muted">{welcome ? "Make your avatar. You can change it any time." : "Make it yours."}</p>
      </div>

      <div className="maker-body">
        <div className="maker-preview">
          <img src={avatarDataUri(choice)} alt={`${name}'s avatar`} width={240} height={240} />
          <button type="button" className="secondary small" onClick={() => { setChoice(randomAvatar()); setAnnounce((a) => (a === "New avatar picked." ? "New avatar picked again." : "New avatar picked.")); }}>
            <DiceIcon /> Surprise me
          </button>
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>

        <div className="maker-controls">
          <div className="part-tabs" role="tablist" aria-label="Part"
            onKeyDown={(e) => arrowKeys(e, (i) => setTab(tabs[i].key), false)}>
            {tabs.map((t) => (
              <button key={t.key} id={`tab-${t.key}`} type="button" role="tab" data-item aria-selected={tab === t.key}
                aria-controls="maker-panel" tabIndex={tab === t.key ? 0 : -1} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          <div id="maker-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={panel}>
            {part ? (
              <div className="tiles" role="radiogroup" aria-label={part.label}
                onKeyDown={(e) => arrowKeys(e, (i) => choose(part.key, tiles[i].value), true)}>
                {tiles.map((t) => (
                  <button key={t.value ?? "none"} type="button" className="tile" role="radio" data-item aria-checked={current === t.value}
                    aria-label={t.label} tabIndex={current === t.value ? 0 : -1} onClick={() => choose(part.key, t.value)}>
                    {t.value === null ? <span className="tile-none" aria-hidden="true">None</span> : <img src={t.src} alt="" loading="lazy" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="swatches" role="radiogroup" aria-label="Colour"
                onKeyDown={(e) => arrowKeys(e, (i) => choose("background", BACKGROUNDS[i].hex), false)}>
                {BACKGROUNDS.map((c) => (
                  <button key={c.hex} type="button" className="swatch" role="radio" data-item aria-checked={choice.background === c.hex}
                    aria-label={c.name} title={c.name} tabIndex={choice.background === c.hex ? 0 : -1}
                    style={{ background: `#${c.hex}` }} onClick={() => choose("background", c.hex)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="maker-actions">
        {welcome ? (
          <form action={later}><SubmitButton className="secondary" pendingText="…">Later</SubmitButton></form>
        ) : (
          <a href="/" className="button secondary">Cancel</a>
        )}
        <form action={save}>
          <input type="hidden" name="avatar" value={JSON.stringify(choice)} />
          <SubmitButton pendingText="Saving…">Save avatar</SubmitButton>
        </form>
      </div>
    </div>
  );
}
