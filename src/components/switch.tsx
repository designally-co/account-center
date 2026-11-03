"use client";

// A plain on/off switch (Buk, 2026-11-03: "make the toggle simple just on and off toggle"). The track fills when
// it is on and the knob slides across. It is a button with role="switch", so a screen reader says "on" or "off".
export function Switch({ on, onChange, label, disabled = false, describedBy }: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} aria-describedby={describedBy} disabled={disabled}
      className={`switch${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}
