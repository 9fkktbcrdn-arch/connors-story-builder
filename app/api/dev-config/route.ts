import { NextResponse } from "next/server";

/**
 * Dev-only: confirms env is visible to the server (never exposes secrets).
 * Visit GET /api/dev-config while `next dev` is running.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  const openaiLooksOk = Boolean(key && key.length > 20 && key.startsWith("sk-"));

  return NextResponse.json({
    openaiKeyLoaded: openaiLooksOk,
    supabaseUrlLoaded: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    serviceRoleLoaded: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hint: openaiLooksOk
      ? "OpenAI key is present. If requests still fail, check billing and model access on platform.openai.com."
      : "OPENAI_API_KEY missing or empty — use the key from https://platform.openai.com/api-keys in connors-story-builder/.env.local",
  });
}
