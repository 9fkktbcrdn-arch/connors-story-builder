"use client";

import type { CharacterInput, ReadingLevelKey, ReadingMode } from "@/types/story";

type Props = {
  premise: string;
  characters: CharacterInput[];
  setting: string;
  mood: string;
  extraRules: string;
  readingMode: ReadingMode;
  readingLevel: ReadingLevelKey;
};

const levelLabel: Record<ReadingLevelKey, string> = {
  easy: "Easy (grades 1–2)",
  medium: "Medium (grades 3–4)",
  advanced: "Advanced (grades 5–6)",
  challenge: "Challenge (adult-style text)",
};

export function StepConfirm({
  premise,
  characters,
  setting,
  mood,
  extraRules,
  readingMode,
  readingLevel,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Review details</h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Confirm these settings before generating chapter one.
        </p>
      </div>
      <dl className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 text-sm shadow-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Story idea
          </dt>
          <dd className="mt-1 text-slate-800">{premise || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Characters
          </dt>
          <dd className="mt-1 text-slate-800">
            {characters.filter((c) => c.name.trim()).length === 0
              ? "—"
              : characters
                  .filter((c) => c.name.trim())
                  .map((c) => (
                    <div key={c.id}>
                      <strong className="font-semibold text-slate-900">{c.name}</strong>
                      {c.type ? ` (${c.type})` : ""}
                      {c.description ? ` — ${c.description}` : ""}
                    </div>
                  ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Setting & mood
          </dt>
          <dd className="mt-1 text-slate-800">
            {setting || "—"}
            {mood ? ` · ${mood}` : ""}
          </dd>
        </div>
        {extraRules.trim() && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Special rules
            </dt>
            <dd className="mt-1 text-slate-800">{extraRules}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reading
          </dt>
          <dd className="mt-1 text-slate-800">
            {readingMode === "read_to_me"
              ? "Read to me (rich language + future highlighting)"
              : `I'll read myself — ${levelLabel[readingLevel]}`}
          </dd>
        </div>
      </dl>
    </div>
  );
}
