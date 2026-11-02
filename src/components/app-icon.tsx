import { Mark } from "./mark";

// An app's own graphic (account.apps.icon, a file under /apps/). Until it has one, its first letter on a soft
// tile in the app's own colour (account.apps.hue), so apps stay easy to tell apart (Buk, 2026-11-02: no orb).
// Account Center itself shows its mark.
export function AppIcon({ appKey, name, icon, hue, size = 28 }: { appKey: string; name: string; icon: string | null; hue: number | null; size?: number }) {
  if (icon) return <img className="app-icon" src={icon} alt="" width={size} height={size} />;
  if (appKey === "account_center") return <Mark size={size} />;
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5), "--h": hue ?? 250 } as React.CSSProperties;
  return <span className="monogram" style={style} aria-hidden="true">{letter}</span>;
}
