// A soft gradient orb that stands for an app (people have avatars). The main colour is the app's hue, stored as
// data (account.apps.hue); the key only adds the neighbouring colours, and the main one when no hue is set.
// Decoration only: screen readers skip it.

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The brand mark's colour: the Account Center app's hue (migration 20261019110000).
export const BRAND_HUE = 190;

// `hue` is the app's chosen colour (account.apps.hue); without one, a colour comes from the seed.
export function Orb({ seed, hue, size = 28 }: { seed: string; hue?: number | null; size?: number }) {
  const h = hash(seed);
  const a = hue ?? h % 360;
  // Neighbouring colours around the app's own hue, so each app reads as one colour (blue, green, pink...).
  const b = (a + 28 + ((h >>> 9) % 20)) % 360;
  const c = (a + 332 - ((h >>> 17) % 20)) % 360;
  const style = {
    width: size,
    height: size,
    "--orb-size": `${size}px`,
    "--orb-a": `hsl(${a} 90% 70%)`,
    "--orb-b": `hsl(${b} 85% 60%)`,
    "--orb-c": `hsl(${c} 80% 80%)`,
  } as React.CSSProperties;
  return <span className="orb" style={style} aria-hidden="true" />;
}
