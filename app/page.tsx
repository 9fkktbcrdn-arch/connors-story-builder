import Link from "next/link";
import { Bookshelf } from "@/components/Library/Bookshelf";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function loadStories() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stories")
      .select("id, title, current_chapter, updated_at, cover_image_url")
      .order("updated_at", { ascending: false })
      .limit(24);
    if (error) {
      console.error(error);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const stories = await loadStories();

  return (
    <div className="library-shell min-h-dvh px-4 py-7 text-slate-100 sm:py-8">
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-sm">
          Your personal library
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Connor&apos;s Story Builder
        </h1>
        <Link href="/new-story" className="secondary-button mt-6 min-w-[min(100%,210px)]">
          Create new story
        </Link>
      </div>

      <section className="relative z-10 mx-auto mt-9 max-w-7xl">
        {stories.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900/60 px-6 py-10 text-center text-lg text-slate-200">
            No books on the shelf yet. Create a story to see it here.
            {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
              <span className="mt-4 block text-sm text-sky-300">
                Tip: add Supabase keys in{" "}
                <code className="rounded bg-slate-800/80 px-1">.env.local</code> and run{" "}
                <code className="rounded bg-slate-800/80 px-1">supabase/schema.sql</code>.
              </span>
            )}
          </div>
        ) : <Bookshelf stories={stories} />}
      </section>
    </div>
  );
}
