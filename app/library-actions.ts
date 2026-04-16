"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "story-images";

async function removeFolder(
  supabase: ReturnType<typeof createAdminClient>,
  path: string
) {
  const { data, error } = await supabase.storage.from(BUCKET).list(path, {
    limit: 100,
  });
  if (error || !data?.length) return;

  const files = data.map((item) => `${path}/${item.name}`);
  if (files.length) {
    await supabase.storage.from(BUCKET).remove(files);
  }
}

export async function deleteStoryAction(formData: FormData) {
  const storyId = String(formData.get("storyId") || "");
  if (!storyId) return;

  const supabase = createAdminClient();
  await removeFolder(supabase, `stories/${storyId}/cover`);
  await removeFolder(supabase, `stories/${storyId}/chapters`);
  await supabase.from("stories").delete().eq("id", storyId);

  revalidatePath("/");
}

