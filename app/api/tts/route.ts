import { NextResponse } from "next/server";
import { APIError } from "openai";
import { getOpenAI } from "@/lib/openai";

const isDev = process.env.NODE_ENV === "development";

type TtsBody = {
  text: string;
  voice?: string;
  speed?: number;
};

const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsBody;
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }
    if (text.length > 12000) {
      return NextResponse.json(
        { error: "Chapter is too long for one audio request." },
        { status: 400 }
      );
    }

    const voice = ALLOWED_VOICES.has(body.voice || "") ? body.voice! : "shimmer";
    const speedRaw = Number(body.speed ?? 1);
    const speed = Number.isFinite(speedRaw)
      ? Math.max(0.5, Math.min(1.5, speedRaw))
      : 1;

    const openai = getOpenAI();
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      speed,
      response_format: "mp3",
    });

    const bytes = Buffer.from(await speech.arrayBuffer());
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof APIError) {
      return NextResponse.json(
        {
          error: `TTS failed (${e.status || "?"}): ${e.message}`,
          ...(isDev && { detail: e.message }),
        },
        { status: e.status || 500 }
      );
    }
    return NextResponse.json(
      {
        error: "Could not create narration audio.",
        ...(isDev && { detail: e instanceof Error ? e.message : String(e) }),
      },
      { status: 500 }
    );
  }
}

