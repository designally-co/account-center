// A soft gradient orb that stands for an app or a person. The colours come from the key, so the same app
// or person always gets the same orb. Decoration only: screen readers skip it.

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Orb({ seed, size = 28, label }: { seed: string; size?: number; label?: string }) {
  const h = hash(seed);
  const a = h % 360;
  const b = (a + 40 + ((h >>> 9) % 80)) % 360;
  const c = (a + 160 + ((h >>> 17) % 60)) % 360;
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.38),
    "--orb-size": `${size}px`,
    "--orb-a": `hsl(${a} 92% 72%)`,
    "--orb-b": `hsl(${b} 88% 64%)`,
    "--orb-c": `hsl(${c} 80% 70%)`,
  } as React.CSSProperties;
  return (
    <span className="orb" style={style} aria-hidden="true">
      {label ? <span className="orb-label">{label}</span> : null}
    </span>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
