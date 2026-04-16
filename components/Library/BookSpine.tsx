import Link from "next/link";
import { deleteStoryAction } from "@/app/library-actions";

type Props = {
  id: string;
  title: string;
  currentChapter: number;
  updatedAt: string;
  coverImageUrl: string | null;
};

export function BookSpine({
  id,
  title,
  currentChapter,
  updatedAt,
  coverImageUrl,
}: Props) {
  return (
    <div className="group">
      <div className="relative overflow-hidden rounded-md border border-slate-700/60 bg-slate-900/70 shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(0,0,0,0.45)]">
        <form action={deleteStoryAction} className="absolute right-2 top-2 z-20">
          <input type="hidden" name="storyId" value={id} />
          <button
            type="submit"
            className="rounded bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-100 hover:bg-black/80"
            aria-label={`Delete ${title}`}
          >
            Del
          </button>
        </form>
        <Link href={`/story/${id}`} className="block aspect-[2/3] overflow-hidden">
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt={title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 px-4 text-center text-xs font-medium uppercase tracking-wide text-slate-300">
              No cover yet
            </div>
          )}
        </Link>
      </div>
      <div className="mt-2 space-y-1 px-1">
        <Link href={`/story/${id}`}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-100 hover:text-white">
            {title}
          </h3>
        </Link>
        <p className="text-xs text-slate-400">
          Ch. {currentChapter} · {new Date(updatedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

