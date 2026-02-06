import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSettingsSchema = z.object({
  defaultProvider: z.enum(["anthropic", "openai"]).optional(),
  defaultModel: z.string().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional(),
  systemPrompt: z.string().max(10000).nullable().optional(),
});

/**
 * GET /api/cowork/settings
 * Get LLM settings for the current organization
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const settings = await db.coworkSettings.findUnique({
      where: { organizationId: org.id },
    });

    // Return defaults if no settings exist yet
    const result = settings || {
      defaultProvider: "anthropic",
      defaultModel: "claude-sonnet-4-20250514",
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: null,
    };

    // Check which providers have API keys configured
    const configuredProviders: string[] = [];
    if (process.env.ANTHROPIC_API_KEY) configuredProviders.push("anthropic");
    if (process.env.OPENAI_API_KEY) configuredProviders.push("openai");

    return NextResponse.json({
      settings: result,
      configuredProviders,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/cowork/settings
 * Update LLM settings for the current organization
 */
export async function PUT(request: Request) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);

    const settings = await db.coworkSettings.upsert({
      where: { organizationId: org.id },
      update: {
        ...(parsed.defaultProvider !== undefined && { defaultProvider: parsed.defaultProvider }),
        ...(parsed.defaultModel !== undefined && { defaultModel: parsed.defaultModel }),
        ...(parsed.temperature !== undefined && { temperature: parsed.temperature }),
        ...(parsed.maxTokens !== undefined && { maxTokens: parsed.maxTokens }),
        ...(parsed.systemPrompt !== undefined && { systemPrompt: parsed.systemPrompt }),
      },
      create: {
        organizationId: org.id,
        defaultProvider: parsed.defaultProvider || "anthropic",
        defaultModel: parsed.defaultModel || "claude-sonnet-4-20250514",
        temperature: parsed.temperature ?? 0.7,
        maxTokens: parsed.maxTokens ?? 4096,
        systemPrompt: parsed.systemPrompt ?? null,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid settings", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
