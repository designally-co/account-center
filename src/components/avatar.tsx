import { avatarDataUri, defaultAvatar, parseAvatar } from "@/lib/avatar";

// A person's avatar: the one they made, or a stable starting face until they make one.
// Decoration only: the person's name is always written next to it.
export function Avatar({ avatar, seed, size = 32 }: { avatar: unknown; seed: string; size?: number }) {
  const choice = parseAvatar(avatar) ?? defaultAvatar(seed);
  return <img className="avatar" src={avatarDataUri(choice)} alt="" width={size} height={size} />;
}
