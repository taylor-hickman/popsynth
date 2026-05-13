import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAllTables } from "@/lib/generate";
import { validatePlanAgainstSchema } from "@/lib/plan-validator";
import { getFormatter } from "@/lib/formatters";
import { GenerationPlan, SchemaIR } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  schema: SchemaIR,
  plan: GenerationPlan,
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
    validatePlanAgainstSchema(parsed.plan, parsed.schema);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const records = await generateAllTables(parsed.plan, parsed.schema, {
            onEvent: (event) => {
              writeSse(controller, encoder, event.type, event);
            },
          });
          const files = getFormatter("csv")(
            records,
            parsed.schema,
            parsed.plan,
          );
          writeSse(controller, encoder, "files", {
            theme: parsed.plan.theme,
            files,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeSse(controller, encoder, "error", { error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function writeSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: string,
  data: unknown,
): void {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}
