import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "story-images";

type Body = {
  storyId: string;
};

async function removeFolder(
  supabase: ReturnType<typeof createAdminClient>,
  path: string
) {
  const { data, error } = await supabase.storage.from(BUCKET).list(path, {
    limit: 100,
  });
  if (error || !data?.length) return;

  const files = data
    .filter((item) => item.name && !item.id?.startsWith?.("folder"))
    .map((item) => `${path}/${item.name}`);

  if (files.length) {
    await supabase.storage.from(BUCKET).remove(files);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.storyId) {
      return NextResponse.json({ error: "storyId is required." }, { status: 400 });
    }

    const supabase = createAdminClient();

    await removeFolder(supabase, `stories/${body.storyId}/cover`);
    await removeFolder(supabase, `stories/${body.storyId}/chapters`);

    const { error } = await supabase.from("stories").delete().eq("id", body.storyId);
    if (error) {
      return NextResponse.json({ error: "Could not delete story." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

