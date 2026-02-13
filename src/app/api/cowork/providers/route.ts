import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { PROVIDERS, getConfiguredProviders } from "@/lib/cowork/llm";

/**
 * GET /api/cowork/providers
 * Returns available LLM providers and their models.
 * Client-safe — no API keys are exposed.
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const configured = getConfiguredProviders();

  // Only return providers that have API keys configured
  const available = Object.entries(PROVIDERS)
    .filter(([key]) => configured.includes(key as "anthropic" | "openai"))
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, (typeof PROVIDERS)[keyof typeof PROVIDERS]>,
    );

  return NextResponse.json({
    providers: available,
    configured,
  });
}
