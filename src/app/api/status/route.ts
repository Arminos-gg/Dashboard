import { aiConfigured, MODEL } from "@/lib/ai.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const online = aiConfigured();
  return Response.json({ ai: { online, model: online ? MODEL : null } });
}
