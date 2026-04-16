"use client";

import type { ReadingLevelKey, ReadingMode } from "@/types/story";

type Props = {
  readingMode: ReadingMode;
  readingLevel: ReadingLevelKey;
  onMode: (m: ReadingMode) => void;
  onLevel: (l: ReadingLevelKey) => void;
};

const LEVELS: { id: ReadingLevelKey; label: string; hint: string }[] = [
  { id: "easy", label: "Easy", hint: "Grades 1–2" },
  { id: "medium", label: "Medium", hint: "Grades 3–4" },
  { id: "advanced", label: "Advanced", hint: "Grades 5–6" },
  { id: "challenge", label: "Challenge", hint: "Rich like read-aloud" },
];

export function StepReadingMode({
  readingMode,
  readingLevel,
  onMode,
  onLevel,
}: Props) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Reading mode</h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Pick how you want to read. You can change this later in the story.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onMode("read_to_me")}
          className={`flex min-h-[112px] flex-col items-start rounded-xl border p-4 text-left transition ${
            readingMode === "read_to_me"
              ? "border-blue-500 bg-blue-50 text-slate-800 shadow-sm"
              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
          }`}
        >
          <span className="text-base font-semibold text-slate-900">Read to me</span>
          <span className="mt-1 text-sm text-slate-600">
            Full narration with word highlighting. Story text uses rich, vivid language.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onMode("read_myself")}
          className={`flex min-h-[112px] flex-col items-start rounded-xl border p-4 text-left transition ${
            readingMode === "read_myself"
              ? "border-blue-500 bg-blue-50 text-slate-800 shadow-sm"
              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
          }`}
        >
          <span className="text-base font-semibold text-slate-900">I&apos;ll read it myself</span>
          <span className="mt-1 text-sm text-slate-600">
            No auto narration (you can still press play anytime). Choose a reading level below.
          </span>
        </button>
      </div>
      {readingMode === "read_myself" && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-600">Reading level</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onLevel(l.id)}
                className={`min-h-[48px] rounded-lg border px-4 py-2.5 text-left transition ${
                  readingLevel === l.id
                    ? "border-blue-500 bg-blue-50 text-slate-800"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">{l.label}</span>
                <span className="text-xs text-slate-500">{l.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
