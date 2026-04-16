import { BookSpine } from "./BookSpine";

type Story = {
  id: string;
  title: string;
  current_chapter: number;
  updated_at: string;
  cover_image_url: string | null;
};

export function Bookshelf({ stories }: { stories: Story[] }) {
  return (
    <div className="relative rounded-2xl border border-slate-700/40 bg-[#0a0f17]/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {stories.map((story) => (
          <li key={story.id}>
            <BookSpine
              id={story.id}
              title={story.title}
              currentChapter={story.current_chapter}
              updatedAt={story.updated_at}
              coverImageUrl={story.cover_image_url}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

