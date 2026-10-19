import { Orb } from "./orb";

// An app's own graphic (account.apps.icon, a file under /apps/); its orb until it has one.
export function AppIcon({ appKey, icon, hue, size = 28 }: { appKey: string; icon: string | null; hue: number | null; size?: number }) {
  if (icon) return <img className="app-icon" src={icon} alt="" width={size} height={size} />;
  return <Orb seed={appKey} hue={hue} size={size} />;
}
