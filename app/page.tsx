import { DEMO_SCHEMA_DDL, DEMO_THEME } from "@/lib/fixtures";
import { HomeClient } from "@/components/HomeClient";
import { PopSynthLogo } from "@/components/PopSynthLogo";

export default function Home() {
  return (
    <div className="flex-1 w-full">
      <header className="brutal-border border-l-0 border-r-0 border-t-0 bg-accent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <PopSynthLogo />
          <p className="brutal-border bg-paper px-2.5 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-widest text-ink sm:max-w-80 sm:text-right sm:text-xs">
            Thematic data generator
          </p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        <HomeClient initialDdl={DEMO_SCHEMA_DDL} initialTheme={DEMO_THEME} />
      </main>
      <footer className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 text-xs uppercase opacity-60">
        Compact planning, bounded inputs, per-table row counts, and streamed
        row generation.
      </footer>
    </div>
  );
}
