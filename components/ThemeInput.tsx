"use client";

import { LIMITS } from "popsynth/core";

const SUGGESTIONS = [
  "Star Wars",
  "Breaking Bad",
  "Wes Anderson hotel lobby",
  "Studio Ghibli forest spirits",
];

export function ThemeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="brutal-border brutal-shadow bg-white p-5 flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold uppercase tracking-wider">Theme</h2>
        <span className="text-xs uppercase opacity-60">freeform</span>
      </header>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={LIMITS.maxThemeChars}
        placeholder="e.g. Breaking Bad, a cozy 1920s English village mystery, Studio Ghibli forest spirits…"
        className="brutal-border bg-paper px-3 py-2 text-base disabled:opacity-60"
      />
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={disabled}
            className="brutal-border bg-paper px-2 py-1 text-xs uppercase hover:bg-accent disabled:opacity-60"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
