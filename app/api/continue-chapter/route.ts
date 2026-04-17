import { NextResponse } from "next/server";
import { APIError } from "openai";
import { buildChapterImagePrompt, generateAndStoreImage } from "@/lib/images";
import { getOpenAI } from "@/lib/openai";
import {
  buildContinuationSystemPrompt,
  buildContinuationUserPrompt,
} from "@/lib/prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GeneratedChapter, ReadingLevelKey } from "@/types/story";

const isDev = process.env.NODE_ENV === "development";

type ContinueBody = {
  storyId: string;
  selectedChoice: string;
  fromChapterNumber: number;
};

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return s;
}

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContinueBody;
    if (!body.storyId || !body.selectedChoice || !body.fromChapterNumber) {
      return NextResponse.json(
        { error: "storyId, selectedChoice, and fromChapterNumber are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select(
        "id,title,premise,characters,setting,mood,extra_rules,reading_level,reading_mode,current_chapter"
      )
      .eq("id", body.storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    const { data: chapters, error: chaptersErr } = await supabase
      .from("chapters")
      .select("id,chapter_number,title,content,summary")
      .eq("story_id", body.storyId)
      .lte("chapter_number", body.fromChapterNumber)
      .order("chapter_number", { ascending: true });

    if (chaptersErr || !chapters || chapters.length === 0) {
      return NextResponse.json(
        { error: "Could not load chapter history for continuation." },
        { status: 500 }
      );
    }

    const olderSummaries = chapters
      .slice(0, Math.max(0, chapters.length - 2))
      .map((c) => c.summary)
      .filter((s): s is string => Boolean(s && s.trim()));

    const recentFull = chapters.slice(-2).map((c) => ({
      chapterNumber: c.chapter_number,
      title: c.title,
      content: c.content,
    }));

    const openai = getOpenAI();
    const system = buildContinuationSystemPrompt({
      premise: story.premise,
      characters: story.characters,
      setting: story.setting,
      mood: story.mood,
      extraRules: story.extra_rules,
      readingMode: story.reading_mode,
      readingLevel: story.reading_level as ReadingLevelKey,
      chapterSummaries: olderSummaries,
      recentChapterTexts: recentFull,
      selectedChoice: body.selectedChoice,
    });

    const user = buildContinuationUserPrompt({
      premise: story.premise,
      characters: story.characters,
      setting: story.setting,
      mood: story.mood,
      extraRules: story.extra_rules,
      readingMode: story.reading_mode,
      readingLevel: story.reading_level as ReadingLevelKey,
      chapterSummaries: olderSummaries,
      recentChapterTexts: recentFull,
      selectedChoice: body.selectedChoice,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
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

    const nextChapterNumber = body.fromChapterNumber + 1;
    const chapterTitle = parsed.chapterTitle?.trim() || `Chapter ${nextChapterNumber}`;
    const displayTitle = chapterTitle.startsWith("Chapter")
      ? chapterTitle
      : `Chapter ${nextChapterNumber}: ${chapterTitle}`;
    const illustrationPrompt = parsed.imagePrompt
      ? buildChapterImagePrompt(parsed.imagePrompt)
      : null;
    const illustrationUrl = illustrationPrompt
      ? await generateAndStoreImage({
          prompt: illustrationPrompt,
          pathPrefix: `stories/${story.id}/chapters`,
          fileLabel: `chapter-${nextChapterNumber}`,
        })
      : null;

    const { data: chapterRow, error: chapterErr } = await supabase
      .from("chapters")
      .insert({
        story_id: story.id,
        chapter_number: nextChapterNumber,
        title: displayTitle,
        content: parsed.content,
        summary: parsed.summary ?? null,
        illustration_url: illustrationUrl,
        illustration_prompt: illustrationPrompt,
        choice_selected: body.selectedChoice,
        choices: parsed.choices ?? [],
        reading_level: story.reading_level,
      })
      .select("id")
      .single();

    if (chapterErr || !chapterRow) {
      return NextResponse.json(
        { error: "Could not save the next chapter." },
        { status: 500 }
      );
    }

    const { error: updateErr } = await supabase
      .from("stories")
      .update({
        current_chapter: nextChapterNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", story.id);

    if (updateErr) {
      return NextResponse.json(
        { error: "Saved the chapter, but could not update current progress." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storyId: story.id,
      chapterId: chapterRow.id,
      chapterNumber: nextChapterNumber,
      chapter: {
        title: displayTitle,
        content: parsed.content,
        summary: parsed.summary,
        choices: parsed.choices ?? [],
        illustrationUrl,
      },
    });
  } catch (e) {
    if (e instanceof APIError) {
      const { text, status } = openAiUserMessage(e);
      return NextResponse.json(
        { error: text, ...(isDev && { detail: e.message }) },
        { status }
      );
    }
    return NextResponse.json(
      {
        error: "The story magic needs a moment... try again!",
        ...(isDev && { detail: e instanceof Error ? e.message : String(e) }),
      },
      { status: 500 }
    );
  }
}
