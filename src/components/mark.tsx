// Account Center's mark: a keyhole in a dark tile, because the app holds the keys to every app
// (Buk, 2026-11-02: no orb). Its colours follow the theme: the tile is the text colour, the keyhole the page.
// Decoration only: the name "Account Center" is always written next to it or in the page title.
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect className="mark-tile" width="32" height="32" rx="9" />
      <g className="mark-hole">
        <circle cx="16" cy="13.4" r="4.3" />
        <path d="M14.1 15.6h3.8l1.1 7.4a.9.9 0 0 1-.9 1h-4.2a.9.9 0 0 1-.9-1z" />
      </g>
    </svg>
  );
}
