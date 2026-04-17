"use client";

import type { CharacterInput } from "@/types/story";
import { CHARACTER_TYPES } from "./characterTypes";

type Props = {
  characters: CharacterInput[];
  onChange: (chars: CharacterInput[]) => void;
};

export function StepCharacters({ characters, onChange }: Props) {
  const update = (id: string, patch: Partial<CharacterInput>) => {
    onChange(
      characters.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const add = () => {
    onChange([
      ...characters,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        type: null,
      },
    ]);
  };

  const remove = (id: string) => {
    if (characters.length <= 1) return;
    onChange(characters.filter((c) => c.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Who are the characters?
        </h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Add the main characters and brief notes to guide the story.
        </p>
      </div>
      <ul className="flex flex-col gap-5">
        {characters.map((c, index) => (
          <li
            key={c.id}
            className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Character {index + 1}</span>
              {characters.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="min-h-[36px] rounded-md px-2 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor={`name-${c.id}`}>
                  Name
                </label>
                <input
                  id={`name-${c.id}`}
                  value={c.name}
                  onChange={(e) => update(c.id, { name: e.target.value })}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
                  placeholder="e.g. Rowan, Captain Voss, Ember the dragon..."
                />
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-600">Role (optional)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CHARACTER_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    update(c.id, { type: c.type === t.label ? null : t.label })
                  }
                  className={`min-h-[36px] min-w-[36px] rounded-full border px-3 py-1.5 text-xs transition ${
                    c.type === t.label
                      ? "border-blue-500 bg-blue-50 text-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label
                className="mb-1 block text-sm font-medium text-slate-600"
                htmlFor={`desc-${c.id}`}
              >
                Describe them in a sentence or two
              </label>
              <textarea
                id={`desc-${c.id}`}
                value={c.description}
                onChange={(e) => update(c.id, { description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
                placeholder="Brave, clumsy, loves riddles..."
              />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="min-h-[42px] rounded-lg border border-dashed border-slate-400 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        + Add another character
      </button>
    </div>
  );
}
