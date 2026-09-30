import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Model used for capture + briefing. Override with ANTHROPIC_MODEL. */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.ANTHROPIC_PROFILE ||
      process.env.LIFE_OS_AI === "on",
  );
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1, timeout: 25_000 });
  return client;
}

/** Maps SDK errors to a JSON response the client can fall back from. */
export function aiErrorResponse(error: unknown): Response {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return Response.json({ error: "ai_unauthorized" }, { status: 503 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "ai_rate_limited" }, { status: 429 });
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error("[life-os] Claude rejected request:", error.message);
    return Response.json({ error: "ai_bad_request" }, { status: 502 });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return Response.json({ error: "ai_unreachable" }, { status: 503 });
  }
  if (error instanceof Anthropic.APIError) {
    console.error("[life-os] Claude API error:", error.status, error.message);
    return Response.json({ error: "ai_error" }, { status: 502 });
  }
  console.error("[life-os] unexpected AI failure:", error);
  return Response.json({ error: "ai_error" }, { status: 500 });
}

export async function readJson<T>(req: Request, maxBytes: number): Promise<T | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
