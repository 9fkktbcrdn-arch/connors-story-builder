import { ChapterView } from "@/components/Reader/ChapterView";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReadingLevelKey, ReadingMode, StoryChoice } from "@/types/story";
import { notFound } from "next/navigation";

type Props = {
  params: { id: string };
  searchParams?: { ch?: string; autoplay?: string };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { id } = params;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("stories").select("title").eq("id", id).single();
    if (data?.title) return { title: `${data.title} · Connor's Story Builder` };
  } catch {
    /* missing env or network */
  }
  return { title: "Story · Connor's Story Builder" };
}

export default async function StoryPage({ params, searchParams }: Props) {
  const { id } = params;
  const supabase = createAdminClient();
  const { data: chapterList, error: listErr } = await supabase
    .from("chapters")
    .select("chapter_number,title")
    .eq("story_id", id)
    .order("chapter_number", { ascending: true });
  if (listErr || !chapterList) notFound();

  const { data: story, error: storyErr } = await supabase
    .from("stories")
    .select("title, current_chapter, reading_mode, reading_level")
    .eq("id", id)
    .single();
  if (storyErr || !story) notFound();

  const actualCurrentChapter = chapterList.length
    ? Math.max(...chapterList.map((c) => c.chapter_number))
    : story.current_chapter;

  const requested = Number(searchParams?.ch);
  const targetChapter =
    Number.isFinite(requested) && requested > 0 ? requested : actualCurrentChapter;

  const { data: chapter, error: chapterErr } = await supabase
    .from("chapters")
    .select("title, content, chapter_number, choices, illustration_url")
    .eq("story_id", id)
    .eq("chapter_number", targetChapter)
    .single();
  if (chapterErr || !chapter) notFound();

  const chapterChoices = Array.isArray(chapter.choices)
    ? (chapter.choices as StoryChoice[])
    : [];
  const autoPlay = searchParams?.autoplay === "1";

  return (
    <ChapterView
      key={`${id}-${targetChapter}`}
      storyId={id}
      storyTitle={story.title}
      chapterNumber={chapter.chapter_number}
      chapterTitle={chapter.title}
      content={chapter.content}
      readingMode={story.reading_mode as ReadingMode}
      readingLevel={story.reading_level as ReadingLevelKey}
      illustrationUrl={chapter.illustration_url}
      choices={chapterChoices}
      chapterList={chapterList.map((c) => ({
        chapterNumber: c.chapter_number,
        title: c.title,
      }))}
      currentChapterNumber={actualCurrentChapter}
      autoPlay={autoPlay}
    />
  );
}
