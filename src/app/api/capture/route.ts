import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiConfigured, aiErrorResponse, anthropic, MODEL, readJson } from "@/lib/ai.server";

export const dynamic = "force-dynamic";

const CaptureSchema = z.object({
  kind: z
    .enum(["task", "event", "habit"])
    .describe(
      "event = an appointment at a set time with people or a place (meeting, lunch, dentist, flight). habit = something to repeat daily. Everything else, including reminders like 'call Alex at 3', is a task.",
    ),
  title: z
    .string()
    .describe("Short imperative title in the user's language, without date/time words or filler such as 'remind me to'. Keep names exactly as written."),
  date: z.string().nullable().describe("Local date YYYY-MM-DD, resolved against the provided current date. null if no date was implied."),
  time: z.string().nullable().describe("Local 24h time HH:MM. A bare hour from 1 to 7 without am/pm means the afternoon or evening. null if no time was given."),
  durationMinutes: z.number().int().nullable().describe("Length in minutes for events (60 if unspecified). null for tasks and habits unless stated."),
  priority: z.enum(["high", "normal", "low"]).describe("high only for explicit urgency or importance; low for 'maybe', 'someday', 'whenever'."),
  tags: z.array(z.string()).describe("0-2 lowercase single-word tags, e.g. work, comms, health, errands, travel, admin, social, learning."),
  notes: z.string().nullable().describe("Any extra detail worth keeping that does not fit the title, else null."),
});

const RequestSchema = z.object({
  text: z.string().min(1).max(500),
  localNow: z.string().max(64),
  timeZone: z.string().max(64),
});

const SYSTEM = `You are the capture engine of a personal planner. You receive one line the user typed and return exactly one structured item.
Resolve relative dates ("tomorrow", "next friday", "in two weeks") against the user's current local date and time, which is given with each request.
Never invent details the user did not imply. Latency-sensitive; begin your visible answer immediately.`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: "ai_not_configured" }, { status: 503 });

  const body = RequestSchema.safeParse(await readJson(req, 4_000));
  if (!body.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { text, localNow, timeZone } = body.data;

  try {
    const msg = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(CaptureSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Current local date and time: ${localNow} (${timeZone}).\nCapture: ${text}`,
        },
      ],
    });

    if (msg.stop_reason === "refusal") return Response.json({ error: "ai_refused" }, { status: 422 });
    const out = msg.parsed_output;
    if (!out) return Response.json({ error: "ai_unparsed" }, { status: 502 });

    return Response.json({
      result: {
        ...out,
        title: out.title.trim().slice(0, 140) || text.slice(0, 140),
        date: out.date && DATE.test(out.date) ? out.date : null,
        time: out.time && TIME.test(out.time) ? out.time : null,
        durationMinutes: out.durationMinutes && out.durationMinutes > 0 ? Math.min(out.durationMinutes, 24 * 60) : null,
        tags: out.tags.map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "")).filter(Boolean).slice(0, 2),
        source: "claude",
      },
      model: msg.model,
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
