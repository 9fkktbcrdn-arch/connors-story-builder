import { getOpenAI } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "story-images";

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function generateAndStoreImage(args: {
  prompt: string;
  pathPrefix: string;
  fileLabel: string;
}) {
  try {
    const openai = getOpenAI();
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: args.prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    const url = result.data?.[0]?.url;
    if (!url) return null;

    const imageRes = await fetch(url);
    if (!imageRes.ok) return null;
    const bytes = Buffer.from(await imageRes.arrayBuffer());

    const fileName = `${args.pathPrefix}/${Date.now()}-${sanitizeFilename(args.fileLabel)}.png`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (error) {
      console.error("Image upload failed", error);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    console.error("Image generation failed", error);
    return null;
  }
}

export function buildChapterImagePrompt(imagePrompt: string) {
  return `Children's book illustration in watercolor style, warm and magical atmosphere, fantasy theme: ${imagePrompt}`;
}

export function buildCoverPrompt(args: {
  title: string;
  premise: string;
  setting?: string | null;
}) {
  return `Children's book cover illustration in watercolor style, warm magical library colors, fantasy adventure, no text in image. Story title inspiration: ${args.title}. Premise: ${args.premise}. Setting: ${args.setting || "fantasy world"}. Focus on a strong central scene suitable for a book cover.`;
}

