"use client";

import { useState } from "react";
import JSZip from "jszip";
import type { FormatterOutput } from "@/lib/types";

export function DownloadPanel({
  files,
  zipName,
}: {
  files: FormatterOutput[];
  zipName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function downloadZip() {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const f of files) zip.file(f.filename, f.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brutal-border brutal-shadow bg-paper p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold uppercase tracking-wider">
          Download
        </h2>
        <span className="text-xs uppercase">{files.length} file(s)</span>
      </div>
      <ul className="text-xs space-y-1">
        {files.map((f) => (
          <li key={f.filename} className="flex justify-between">
            <span>{f.filename}</span>
            <span className="opacity-60">{f.content.length} chars</span>
          </li>
        ))}
      </ul>
      <button
        onClick={downloadZip}
        disabled={busy || files.length === 0}
        className="brutal-border bg-ink text-paper uppercase font-bold px-4 py-2 tracking-wider hover:bg-cool disabled:opacity-50 transition-colors"
      >
        {busy ? "Packaging…" : "Download .zip"}
      </button>
    </div>
  );
}
