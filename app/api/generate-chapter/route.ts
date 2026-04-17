import { NextResponse } from "next/server";
import { APIError } from "openai";
import {
  buildChapterImagePrompt,
  buildCoverPrompt,
  generateAndStoreImage,
} from "@/lib/images";
import { getOpenAI } from "@/lib/openai";
import { buildFirstChapterSystemPrompt } from "@/lib/prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GeneratedChapter, WizardPayload } from "@/types/story";

const isDev = process.env.NODE_ENV === "development";

function openAiUserMessage(err: APIError): { text: string; status: number } {
  const status = err.status ?? 500;
  const body = String(err.message ?? "").toLowerCase();
  if (status === 401) {
    return {
      text: "OpenAI rejected your API key. Create a key at platform.openai.com/api-keys and paste it as OPENAI_API_KEY in .env.local, then restart the dev server.",
      status: 401,
    };
  }
  if (status === 429 || body.includes("rate limit")) {
    return {
      text: "OpenAI rate limit — wait a minute and try again.",
      status: 429,
    };
  }
  if (
    status === 403 ||
    body.includes("insufficient_quota") ||
    body.includes("billing") ||
    body.includes("quota")
  ) {
    return {
      text: "OpenAI billing or quota issue — add payment method or credits at platform.openai.com (API billing, not ChatGPT Plus).",
      status: 503,
    };
  }
  if (status === 404 || body.includes("model")) {
    return {
      text: `OpenAI model error: ${err.message}. Check that your account can use gpt-4o.`,
      status: 502,
    };
  }
  return {
    text: `OpenAI error (${status || "?"}): ${err.message || "Unknown"}`,
    status: status >= 400 && status < 600 ? status : 502,
  };
}

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return s;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WizardPayload;
    if (!body?.premise?.trim()) {
      return NextResponse.json({ error: "Premise is required." }, { status: 400 });
    }

    const openai = getOpenAI();
    const system = buildFirstChapterSystemPrompt(body);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Write chapter 1 of this adventure. Remember: JSON only, with storyTitle, chapterTitle, content, summary, imagePrompt, and exactly three choices.",
        },
      ],
      temperature: 0.92,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "The story magic needs a moment... try again!" },
        { status: 502 }
      );
    }

    let parsed: GeneratedChapter;
    try {
      parsed = JSON.parse(stripJsonFence(raw)) as GeneratedChapter;
    } catch {
      return NextResponse.json(
        { error: "Could not read the story from the stars. Try again!" },
        { status: 502 }
      );
    }

    const storyTitle =
      (parsed.storyTitle && String(parsed.storyTitle).trim()) ||
      body.premise.slice(0, 72).trim() + (body.premise.length > 72 ? "…" : "");

    const supabase = createAdminClient();

    const readingLevelStored =
      body.readingMode === "read_to_me" ? "advanced" : body.readingLevel;

    const { data: storyRow, error: storyErr } = await supabase
      .from("stories")
      .insert({
        title: storyTitle,
        premise: body.premise.trim(),
        characters: body.characters,
        setting: body.setting?.trim() || null,
        mood: body.mood?.trim() || null,
        extra_rules: body.extraRules?.trim() || null,
        reading_level: readingLevelStored,
        reading_mode: body.readingMode,
        current_chapter: 1,
      })
      .select("id")
      .single();

    if (storyErr || !storyRow) {
      console.error(storyErr);
      return NextResponse.json(
        { error: "Could not save your story. Check Supabase setup." },
        { status: 500 }
      );
    }

    const chapterTitle = parsed.chapterTitle?.trim() || "Chapter 1";
    const displayTitle = chapterTitle.startsWith("Chapter")
      ? chapterTitle
      : `Chapter 1: ${chapterTitle}`;

    const illustrationPrompt = parsed.imagePrompt
      ? buildChapterImagePrompt(parsed.imagePrompt)
      : null;
    const [coverImageUrl, illustrationUrl] = await Promise.all([
      generateAndStoreImage({
        prompt: buildCoverPrompt({
          title: storyTitle,
          premise: body.premise.trim(),
          setting: body.setting?.trim() || null,
        }),
        pathPrefix: `stories/${storyRow.id}/cover`,
        fileLabel: storyTitle,
      }),
      illustrationPrompt
        ? generateAndStoreImage({
            prompt: illustrationPrompt,
            pathPrefix: `stories/${storyRow.id}/chapters`,
            fileLabel: `chapter-1`,
          })
        : Promise.resolve(null),
    ]);

    if (coverImageUrl) {
      await supabase
        .from("stories")
        .update({ cover_image_url: coverImageUrl })
        .eq("id", storyRow.id);
    }

    const { data: chapterRow, error: chapterErr } = await supabase
      .from("chapters")
      .insert({
        story_id: storyRow.id,
        chapter_number: 1,
        title: displayTitle,
        content: parsed.content,
        summary: parsed.summary ?? null,
        illustration_url: illustrationUrl,
        illustration_prompt: illustrationPrompt,
        choice_selected: null,
        choices: parsed.choices ?? [],
        reading_level: readingLevelStored,
      })
      .select("id")
      .single();

    if (chapterErr || !chapterRow) {
      console.error(chapterErr);
      await supabase.from("stories").delete().eq("id", storyRow.id);
      return NextResponse.json(
        { error: "Could not save the first chapter." },
        { status: 500 }
      );
    }

    await supabase
      .from("stories")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", storyRow.id);

    return NextResponse.json({
      storyId: storyRow.id,
      chapterId: chapterRow.id,
      storyTitle,
      chapter: {
        title: displayTitle,
        content: parsed.content,
        summary: parsed.summary,
        choices: parsed.choices,
        illustrationUrl,
      },
    });
  } catch (e) {
    console.error(e);

    if (e instanceof APIError) {
      const { text, status } = openAiUserMessage(e);
      return NextResponse.json(
        {
          error: text,
          ...(isDev && { detail: e.message }),
        },
        { status }
      );
    }

    if (e instanceof Error && e.message.includes("OPENAI")) {
      return NextResponse.json(
        {
          error:
            "Story AI is not configured: add OPENAI_API_KEY to .env.local in connors-story-builder, save, restart npm run dev. (API key from platform.openai.com — not the ChatGPT website.)",
          ...(isDev && { detail: e.message }),
        },
        { status: 500 }
      );
    }

    if (e instanceof Error && e.message.includes("SUPABASE")) {
      return NextResponse.json(
        {
          error: "Supabase is not configured.",
          ...(isDev && { detail: e.message }),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "The story magic needs a moment... try again!",
        ...(isDev && {
          detail: e instanceof Error ? e.message : String(e),
        }),
      },
      { status: 500 }
    );
  }
}
