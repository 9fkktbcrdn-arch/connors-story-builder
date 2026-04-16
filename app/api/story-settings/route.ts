import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReadingLevelKey, ReadingMode } from "@/types/story";

type Body = {
  storyId: string;
  readingMode: ReadingMode;
  readingLevel: ReadingLevelKey;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.storyId || !body.readingMode || !body.readingLevel) {
      return NextResponse.json(
        { error: "storyId, readingMode, and readingLevel are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("stories")
      .update({
        reading_mode: body.readingMode,
        reading_level: body.readingLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.storyId);

    if (error) {
      return NextResponse.json(
        { error: "Could not update reading preferences." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

