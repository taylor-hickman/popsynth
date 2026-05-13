import { NextResponse } from "next/server";
import { z } from "zod";
import { runMappingAgent } from "@/lib/agent";
import { SchemaIR } from "@/lib/types";
import { LIMITS, RowCounts, normalizeRowCounts } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  schema: SchemaIR,
  theme: z.string().trim().min(1).max(LIMITS.maxThemeChars),
  rowCounts: RowCounts.optional(),
});

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Invalid request body: ${message}` },
      { status: 400 },
    );
  }

  try {
    const rowCounts = normalizeRowCounts(parsed.schema, parsed.rowCounts);
    const plan = await runMappingAgent(
      parsed.schema,
      parsed.theme,
      rowCounts,
    );
    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
