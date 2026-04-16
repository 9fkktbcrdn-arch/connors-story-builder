"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CharacterInput, ReadingLevelKey, ReadingMode, WizardPayload } from "@/types/story";
import { StepCharacters } from "./StepCharacters";
import { StepConfirm } from "./StepConfirm";
import { StepPremise } from "./StepPremise";
import { StepReadingMode } from "./StepReadingMode";
import { StepSetting } from "./StepSetting";

const STEPS = 5;

function initialCharacter(): CharacterInput {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    type: null,
  };
}

export function StoryWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [premise, setPremise] = useState("");
  const [characters, setCharacters] = useState<CharacterInput[]>([initialCharacter()]);
  const [setting, setSetting] = useState("");
  const [mood, setMood] = useState("");
  const [extraRules, setExtraRules] = useState("");
  const [readingMode, setReadingMode] = useState<ReadingMode>("read_to_me");
  const [readingLevel, setReadingLevel] = useState<ReadingLevelKey>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo<WizardPayload>(
    () => ({
      premise,
      characters,
      setting,
      mood,
      extraRules,
      readingMode,
      readingLevel,
    }),
    [premise, characters, setting, mood, extraRules, readingMode, readingLevel]
  );

  const canNext = () => {
    if (step === 1) return premise.trim().length >= 1;
    if (step === 2) return characters.some((c) => c.name.trim().length > 0);
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    setStep((s) => Math.min(STEPS, s + 1));
    setError(null);
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
    setError(null);
  };

  const begin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const base = data.error || "Something went wrong.";
        const tech =
          process.env.NODE_ENV === "development" && data.detail
            ? ` (${String(data.detail)})`
            : "";
        setError(base + tech);
        return;
      }
      router.push(`/story/${data.storyId}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 text-slate-900">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          ← Library
        </Link>
        <div
          className="flex gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2"
          role="tablist"
          aria-label="Wizard progress"
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-6 rounded-full ${
                i + 1 <= step ? "bg-blue-600" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="panel p-6 sm:p-10">
        {step === 1 && (
          <StepPremise
            value={premise}
            onChange={setPremise}
            canContinue={canNext()}
          />
        )}
        {step === 2 && <StepCharacters characters={characters} onChange={setCharacters} />}
        {step === 3 && (
          <StepSetting
            setting={setting}
            mood={mood}
            extraRules={extraRules}
            onSetting={setSetting}
            onMood={setMood}
            onExtraRules={setExtraRules}
          />
        )}
        {step === 4 && (
          <StepReadingMode
            readingMode={readingMode}
            readingLevel={readingLevel}
            onMode={setReadingMode}
            onLevel={setReadingLevel}
          />
        )}
        {step === 5 && (
          <StepConfirm
            premise={premise}
            characters={characters}
            setting={setting}
            mood={mood}
            extraRules={extraRules}
            readingMode={readingMode}
            readingLevel={readingLevel}
          />
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1 || loading}
            className="min-h-[42px] min-w-[104px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext()}
              title={
                !canNext() && step === 1
                  ? "Type something in the box above first"
                  : !canNext() && step === 2
                    ? "Add at least one character name"
                    : undefined
              }
              className="primary-button min-w-[110px] px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={begin}
              disabled={loading}
              className="primary-button min-w-[180px] px-6 py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? "Writing..." : "Create story"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
