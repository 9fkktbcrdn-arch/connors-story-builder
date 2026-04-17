"use client";

import type { StoryChoice } from "@/types/story";

type Props = {
  choices: StoryChoice[];
  onChoose: (choiceText: string) => void;
  loading: boolean;
};

export function ChoiceCards({ choices, onChoose, loading }: Props) {
  if (!choices.length) return null;

  return (
    <section className="mt-8 rounded-2xl border-2 border-gold/40 bg-white/95 p-4 sm:p-5">
      <h2 className="text-xl font-semibold text-wood">Choose what happens next</h2>
      <p className="mt-1 text-sm text-ink/70">
        Pick one path. Wait for the next chapter to load before tapping again.
      </p>
      <div
        className={`mt-4 grid gap-3 ${loading ? "pointer-events-none opacity-70" : ""}`}
        aria-busy={loading}
      >
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={loading}
            onClick={() => onChoose(choice.text)}
            className="min-h-[72px] touch-manipulation rounded-xl border-2 border-wood/20 bg-parchment px-4 py-4 text-left text-base text-ink transition hover:border-teal active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="font-semibold text-wood">Choice {choice.id}</span>
            <span className="mt-1 block">{choice.text}</span>
          </button>
        ))}
      </div>
      {loading && (
        <p className="mt-3 text-sm font-medium text-teal">
          The story continues... writing the next chapter.
        </p>
      )}
    </section>
  );
}
