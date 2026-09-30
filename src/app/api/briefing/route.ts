import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiConfigured, aiErrorResponse, anthropic, MODEL, readJson } from "@/lib/ai.server";

export const dynamic = "force-dynamic";

const BriefingSchema = z.object({
  headline: z.string().describe("At most 10 words. Calm, editorial, specific to today. No emoji, no exclamation marks."),
  paragraphs: z
    .array(z.string())
    .describe("2 or 3 short paragraphs, each at most 40 words: what matters, where the open time is and how to use it, one practical note (weather, energy, a streak at stake)."),
  focusWindow: z
    .object({
      start: z.string().describe("HH:MM local"),
      end: z.string().describe("HH:MM local"),
      reason: z.string().describe("At most 12 words"),
    })
    .nullable()
    .describe("The best remaining uninterrupted block for deep work today, or null if none is left."),
  nextMove: z.string().describe("One imperative sentence of at most 14 words: the single best thing to do right now."),
});

const Snapshot = z.object({
  localNow: z.string().max(64),
  timeZone: z.string().max(64),
  name: z.string().max(60).optional(),
  mood: z.string().max(20),
  tasks: z
    .array(
      z.object({
        title: z.string().max(160),
        due: z.string().max(40).nullable(),
        priority: z.enum(["high", "normal", "low"]),
        tags: z.array(z.string().max(24)).max(4),
      }),
    )
    .max(30),
  doneToday: z.array(z.string().max(160)).max(30),
  events: z
    .array(z.object({ title: z.string().max(160), start: z.string().max(8), end: z.string().max(8), location: z.string().max(80).nullable() }))
    .max(20),
  habits: z.array(z.object({ name: z.string().max(60), doneToday: z.boolean(), streak: z.number().int() })).max(12),
  weather: z
    .object({ summary: z.string().max(40), temp: z.number(), hi: z.number(), lo: z.number(), precipProb: z.number(), location: z.string().max(60) })
    .nullable(),
  focusMinutesToday: z.number(),
});

const SYSTEM = `You write the daily briefing for a personal command center — a calm, precise voice, like a chief of staff who respects the reader's time.
Ground every sentence in the data you are given: name the actual tasks, events and times. Never invent commitments.
Prefer concrete time ranges ("14:00–16:30") over vague advice. Use 24-hour times. Address the reader directly, without greeting them.`;

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: "ai_not_configured" }, { status: 503 });

  const body = Snapshot.safeParse(await readJson(req, 24_000));
  if (!body.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const snap = body.data;

  try {
    const msg = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(BriefingSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Write today's briefing from this snapshot of my day:\n${JSON.stringify(snap, null, 1)}`,
        },
      ],
    });

    if (msg.stop_reason === "refusal") return Response.json({ error: "ai_refused" }, { status: 422 });
    const out = msg.parsed_output;
    if (!out) return Response.json({ error: "ai_unparsed" }, { status: 502 });

    return Response.json({ briefing: { ...out, paragraphs: out.paragraphs.slice(0, 3) }, model: msg.model });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
