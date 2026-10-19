"use client";

import { useMemo, useState } from "react";
import { BACKGROUNDS, PARTS, avatarDataUri, randomAvatar, type AvatarChoice, type PartKey } from "@/lib/avatar";

// Parts drawn close up in their tiles; the others show the whole figure.
const CLOSE_UP = new Set(["hair", "eyes", "brows", "lips", "nose", "glasses", "beard"]);

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

export function AvatarMaker({ save, start, welcome, name }: {
  save: (form: FormData) => Promise<void>;
  start: AvatarChoice;
  welcome: boolean;
  name: string;
}) {
  const [choice, setChoice] = useState(start);
  const [tab, setTab] = useState<string>("hair");
  const part = PARTS.find((p) => p.key === tab);

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

  return (
    <div className="maker">
      <div className="maker-head stack tight">
        <h1>{welcome ? `Welcome, ${name}` : "Your avatar"}</h1>
        <p className="muted">{welcome ? "Make your avatar. You can change it any time." : "Make it yours."}</p>
      </div>

      <div className="maker-body">
        <div className="maker-preview">
          <img src={avatarDataUri(choice)} alt={`${name}'s avatar`} width={240} height={240} />
          <button type="button" className="secondary small" onClick={() => setChoice(randomAvatar())}>
            <DiceIcon /> Surprise me
          </button>
        </div>

        <div className="maker-controls">
          <div className="part-tabs" role="group" aria-label="Part">
            {PARTS.map((p) => (
              <button key={p.key} type="button" aria-pressed={tab === p.key} onClick={() => setTab(p.key)}>{p.label}</button>
            ))}
            <button type="button" aria-pressed={tab === "background"} onClick={() => setTab("background")}>Colour</button>
          </div>

          {part ? (
            <div className="tiles" role="group" aria-label={part.label}>
              {tiles.map((t) => (
                <button key={t.value ?? "none"} type="button" className="tile" aria-pressed={choice[part.key as PartKey] === t.value}
                  aria-label={t.label} onClick={() => setChoice({ ...choice, [part.key]: t.value })}>
                  {t.value === null ? <span className="tile-none" aria-hidden="true">None</span> : <img src={t.src} alt="" loading="lazy" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="swatches" role="group" aria-label="Colour">
              {BACKGROUNDS.map((c, i) => (
                <button key={c} type="button" className="swatch" aria-pressed={choice.background === c} aria-label={`Colour ${i + 1}`}
                  style={{ background: `#${c}` }} onClick={() => setChoice({ ...choice, background: c })} />
              ))}
            </div>
          )}
        </div>
      </div>

      <form action={save} className="maker-actions">
        <input type="hidden" name="avatar" value={JSON.stringify(choice)} />
        {welcome ? <a href="/" className="button secondary">Later</a> : <a href="/" className="button secondary">Cancel</a>}
        <button type="submit">Save avatar</button>
      </form>
    </div>
  );
}
