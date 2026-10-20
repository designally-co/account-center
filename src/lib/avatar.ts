import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

// A person's avatar: drawn faces in the Notion style ("Notionists" by Zoish, CC0; DiceBear, MIT).
// Stored as these choices (structured data), never as an image. The drawing is made from them on demand.

type Schema = { properties: Record<string, { items?: { enum?: string[] } }> };
const schema = notionists.schema as unknown as Schema;

function variants(part: string): string[] {
  return [...(schema.properties[part]?.items?.enum ?? [])].sort();
}

// The parts a person can choose, in the order the maker shows them. `optional` parts can also be "none".
export const PARTS = [
  { key: "hair", label: "Hair", optional: false },
  { key: "eyes", label: "Eyes", optional: false },
  { key: "brows", label: "Brows", optional: false },
  { key: "lips", label: "Mouth", optional: false },
  { key: "nose", label: "Nose", optional: false },
  { key: "glasses", label: "Glasses", optional: true },
  { key: "beard", label: "Beard", optional: true },
  { key: "body", label: "Outfit", optional: false },
  { key: "gesture", label: "Hands", optional: true },
  { key: "bodyIcon", label: "Badge", optional: true },
].map((p) => ({ ...p, options: variants(p.key) }));

export type PartKey = "hair" | "eyes" | "brows" | "lips" | "nose" | "glasses" | "beard" | "body" | "gesture" | "bodyIcon";

// Soft backgrounds, like paper, with names for screen readers. Hex without "#", as the drawing library wants it.
export const BACKGROUNDS = [
  { hex: "f4efe6", name: "Cream" }, { hex: "fde2d8", name: "Peach" }, { hex: "fcefc7", name: "Butter" },
  { hex: "dff3e4", name: "Mint" }, { hex: "d9ecf7", name: "Sky" }, { hex: "e6e1f7", name: "Lilac" },
  { hex: "f6dcec", name: "Rose" }, { hex: "e8e8e6", name: "Stone" },
];
const BACKGROUND_HEX = BACKGROUNDS.map((b) => b.hex);

export type AvatarChoice = Record<PartKey, string | null> & { background: string };

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The outfits that have room for a badge. Worked out from the drawings themselves (a badge changes the
// drawing only on these), so it stays right if the drawing library changes.
export const BADGE_OUTFITS: ReadonlySet<string> = new Set(
  PARTS.find((p) => p.key === "body")!.options.filter((body) => {
    const base = { background: "f4efe6", hair: null, eyes: null, brows: null, lips: null, nose: null, glasses: null, beard: null, gesture: null } as const;
    const plain = drawing({ ...base, body, bodyIcon: null }).toString();
    return PARTS.find((p) => p.key === "bodyIcon")!.options.some((icon) => drawing({ ...base, body, bodyIcon: icon }).toString() !== plain);
  }),
);

// A stable starting avatar for someone who has not made one: the same person always gets the same face.
export function defaultAvatar(seed: string): AvatarChoice {
  const pick = (part: string, list: string[]) => list[hash(`${seed}:${part}`) % list.length];
  const sometimes = (part: string, list: string[], percent: number) =>
    hash(`${seed}:${part}:on`) % 100 < percent ? pick(part, list) : null;
  const choice = { background: pick("background", BACKGROUND_HEX) } as AvatarChoice;
  for (const p of PARTS) {
    const key = p.key as PartKey;
    choice[key] = !p.optional ? pick(key, p.options)
      : key === "glasses" ? sometimes(key, p.options, 25)
      : key === "beard" ? sometimes(key, p.options, 15)
      : null;
  }
  return choice;
}

// A random avatar, for "Surprise me".
export function randomAvatar(): AvatarChoice {
  return defaultAvatar(Math.random().toString(36).slice(2));
}

// Only known parts with known values are accepted; anything else makes the whole avatar invalid.
export function parseAvatar(raw: unknown): AvatarChoice | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const allowed = new Set(["background", ...PARTS.map((p) => p.key)]);
  if (Object.keys(input).some((k) => !allowed.has(k))) return null;
  if (typeof input.background !== "string" || !BACKGROUND_HEX.includes(input.background)) return null;
  const choice = { background: input.background } as AvatarChoice;
  for (const p of PARTS) {
    const value = input[p.key];
    if (value === null || value === undefined) {
      if (!p.optional) return null;
      choice[p.key as PartKey] = null;
    } else if (typeof value === "string" && p.options.includes(value)) {
      choice[p.key as PartKey] = value;
    } else {
      return null;
    }
  }
  // A badge only shows on some outfits; on the others it is dropped, so it never pops up unseen later.
  if (choice.bodyIcon && !BADGE_OUTFITS.has(choice.body ?? "")) choice.bodyIcon = null;
  return choice;
}

// The drawing, as an image address the browser can show directly (an <img>, never inline SVG).
export function avatarDataUri(choice: AvatarChoice, focus: "full" | "face" = "full"): string {
  return drawing(choice, focus).toDataUri();
}

function drawing(choice: Omit<AvatarChoice, "background"> & { background: string }, focus: "full" | "face" = "full") {
  const on = (v: string | null) => (v ? [v] : undefined);
  return createAvatar(notionists, {
    seed: "fixed",
    backgroundColor: [choice.background],
    hair: on(choice.hair) as never,
    eyes: on(choice.eyes) as never,
    brows: on(choice.brows) as never,
    lips: on(choice.lips) as never,
    nose: on(choice.nose) as never,
    body: on(choice.body) as never,
    glasses: on(choice.glasses) as never,
    glassesProbability: choice.glasses ? 100 : 0,
    beard: on(choice.beard) as never,
    beardProbability: choice.beard ? 100 : 0,
    gesture: on(choice.gesture) as never,
    gestureProbability: choice.gesture ? 100 : 0,
    bodyIcon: on(choice.bodyIcon) as never,
    bodyIconProbability: choice.bodyIcon ? 100 : 0,
    ...(focus === "face" ? { scale: 150, translateY: 14 } : {}),
  });
}
