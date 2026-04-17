"use client";

import { useState } from "react";
import type { SpeechPlayback, TtsVoiceOption } from "@/hooks/useOpenAITts";

const RATES: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5];

type Props = {
  playback: SpeechPlayback;
  isSpeaking: boolean;
  isPaused: boolean;
  rate: number;
  onRateChange: (rate: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  speechError: string | null;
  voices: TtsVoiceOption[];
  voiceURI: string;
  onVoiceURI: (uri: string) => void;
  isLoadingAudio?: boolean;
};

export function AudioControls({
  playback,
  isSpeaking,
  isPaused,
  rate,
  onRateChange,
  onPlay,
  onPause,
  onResume,
  onRestart,
  speechError,
  voices,
  voiceURI,
  onVoiceURI,
  isLoadingAudio,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const showPlay = playback === "idle" || playback === "ended";
  const showPause = isSpeaking && !isPaused;
  const showResume = isPaused;

  const availableVoices = voices;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-wood/20 bg-white/95 p-3 text-ink shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {showPlay && (
            <button
              type="button"
              onClick={onPlay}
              disabled={isLoadingAudio}
              className="min-h-[52px] min-w-[100px] touch-manipulation rounded-xl bg-teal px-4 text-base font-bold text-white shadow-md hover:brightness-105"
            >
              {isLoadingAudio ? "Loading..." : "Play"}
            </button>
          )}
          {showPause && (
            <button
              type="button"
              onClick={onPause}
              className="min-h-[52px] min-w-[100px] touch-manipulation rounded-xl bg-wood px-4 text-base font-semibold text-parchment hover:brightness-110"
            >
              Pause
            </button>
          )}
          {showResume && (
            <button
              type="button"
              onClick={onResume}
              className="min-h-[52px] min-w-[100px] touch-manipulation rounded-xl bg-teal px-4 text-base font-bold text-white shadow-md hover:brightness-105"
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[52px] touch-manipulation rounded-xl border-2 border-gold bg-parchment px-4 text-base font-semibold text-wood hover:bg-white"
          >
            Start over
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="min-h-[48px] touch-manipulation rounded-lg border border-wood/25 px-3 text-sm font-medium text-wood hover:bg-parchment"
          aria-expanded={expanded}
        >
          {expanded ? "Less options" : "More options"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-wood/15 pt-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-ink/80">Speed</p>
          <div className="flex flex-wrap gap-2">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRateChange(r)}
                className={`min-h-[48px] min-w-[52px] touch-manipulation rounded-lg border-2 px-3 text-base font-semibold ${
                  rate === r
                    ? "border-teal bg-teal/15 text-wood"
                    : "border-wood/20 bg-parchment text-ink hover:border-gold"
                }`}
              >
                {r === 1 ? "1×" : `${r}×`}
              </button>
            ))}
          </div>
        </div>
        {availableVoices.length > 0 && (
          <div className="min-w-[min(100%,220px)] flex-1 sm:max-w-xs">
            <label className="mb-2 block text-sm font-medium text-ink/80" htmlFor="voice">
              Voice
            </label>
            <select
              id="voice"
              value={voiceURI}
              onChange={(e) => onVoiceURI(e.target.value)}
              className="min-h-[52px] w-full touch-manipulation rounded-xl border-2 border-wood/20 bg-white px-3 text-base text-ink"
            >
              {availableVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}
        </div>
      )}

      {speechError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-950">
          {speechError}
        </p>
      )}
    </div>
  );
}
