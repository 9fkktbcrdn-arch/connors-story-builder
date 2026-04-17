"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useOpenAITts } from "@/hooks/useOpenAITts";
import type { ReadingLevelKey, ReadingMode, StoryChoice } from "@/types/story";
import { AudioControls } from "./AudioControls";
import { ChoiceCards } from "./ChoiceCards";
import { HighlightedText } from "./HighlightedText";

type Props = {
  storyId: string;
  storyTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  content: string;
  readingMode: ReadingMode;
  readingLevel: ReadingLevelKey;
  illustrationUrl: string | null;
  choices: StoryChoice[];
  chapterList: { chapterNumber: number; title: string }[];
  currentChapterNumber: number;
  autoPlay?: boolean;
};

const MIN_FONT = 18;
const MAX_FONT = 36;
const DEFAULT_FONT = 23;

export function ChapterView({
  storyId,
  storyTitle,
  chapterNumber,
  chapterTitle,
  content,
  readingMode,
  readingLevel,
  illustrationUrl,
  choices,
  chapterList,
  currentChapterNumber,
  autoPlay = false,
}: Props) {
  const router = useRouter();
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [rate, setRate] = useState(1);
  const [voiceURI, setVoiceURI] = useState<string>("shimmer");
  const [readingModeSetting, setReadingModeSetting] = useState<ReadingMode>(readingMode);
  const [readingLevelSetting, setReadingLevelSetting] = useState<ReadingLevelKey>(readingLevel);
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(readingMode === "read_myself");
  const [restartAfterSettingsChange, setRestartAfterSettingsChange] = useState(false);
  const [resumeProgress, setResumeProgress] = useState(0);

  const {
    playback,
    isSpeaking,
    isPaused,
    hasFinished,
    currentWordIndex,
    speechError,
    speak,
    seekAndPlay,
    getProgress,
    pause,
    resume,
    stop,
    isLoadingAudio,
    voices,
    needsUserGesture,
    dismissAutoplayBlock,
  } = useOpenAITts(content, rate, voiceURI);

  useEffect(() => {
    setContinueError(null);
    setContinueLoading(false);
    setShowChoices(readingMode === "read_myself");
    setReadingModeSetting(readingMode);
    setReadingLevelSetting(readingLevel);
    setSettingsMessage(null);
  }, [chapterNumber, readingMode, readingLevel]);

  useEffect(() => {
    if (readingMode !== "read_to_me" || !hasFinished) return;
    const timer = setTimeout(() => setShowChoices(true), 1200);
    return () => clearTimeout(timer);
  }, [readingMode, hasFinished]);

  useLayoutEffect(() => {
    if (!autoPlay || readingMode !== "read_to_me") return;
    void speak();
  }, [autoPlay, readingMode, speak, chapterNumber]);

  useEffect(() => {
    if (!restartAfterSettingsChange) return;
    stop();
    const timer = window.setTimeout(() => {
      void seekAndPlay(resumeProgress);
      setRestartAfterSettingsChange(false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [restartAfterSettingsChange, seekAndPlay, stop, resumeProgress]);

  const handleRateChange = useCallback(
    (r: number) => {
      const progress = getProgress();
      setRate(r);
      if (isSpeaking || isPaused) {
        setResumeProgress(progress);
        setRestartAfterSettingsChange(true);
      }
    },
    [getProgress, isSpeaking, isPaused]
  );

  const handleVoiceURI = useCallback(
    (uri: string) => {
      const progress = getProgress();
      setVoiceURI(uri);
      if (isSpeaking || isPaused) {
        setResumeProgress(progress);
        setRestartAfterSettingsChange(true);
      }
    },
    [getProgress, isSpeaking, isPaused]
  );

  const handleRestart = useCallback(() => {
    stop();
    queueMicrotask(() => speak());
  }, [stop, speak]);

  const bumpFont = (delta: number) => {
    setFontSize((s) => Math.min(MAX_FONT, Math.max(MIN_FONT, s + delta)));
  };

  const canContinue = useMemo(
    () => chapterNumber === currentChapterNumber,
    [chapterNumber, currentChapterNumber]
  );

  const saveReadingPreferences = useCallback(
    async (mode: ReadingMode, level: ReadingLevelKey) => {
      setSettingsSaving(true);
      setSettingsMessage(null);
      try {
        const res = await fetch("/api/story-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            readingMode: mode,
            readingLevel: level,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSettingsMessage(data.error || "Could not save reading settings.");
          return;
        }
        setSettingsMessage("Saved for the next chapter.");
        router.refresh();
      } catch {
        setSettingsMessage("Could not save reading settings.");
      } finally {
        setSettingsSaving(false);
      }
    },
    [router, storyId]
  );

  const handleReadingModeChange = useCallback(
    (mode: ReadingMode) => {
      setReadingModeSetting(mode);
      const nextLevel = mode === "read_to_me" ? "advanced" : readingLevelSetting;
      if (mode === "read_to_me") {
        setReadingLevelSetting("advanced");
      }
      void saveReadingPreferences(mode, nextLevel);
    },
    [readingLevelSetting, saveReadingPreferences]
  );

  const handleReadingLevelChange = useCallback(
    (level: ReadingLevelKey) => {
      setReadingLevelSetting(level);
      void saveReadingPreferences(readingModeSetting, level);
    },
    [readingModeSetting, saveReadingPreferences]
  );

  const handleChoose = useCallback(
    async (choiceText: string) => {
      if (!canContinue || continueLoading) return;
      setShowChoices(false);
      setContinueLoading(true);
      setContinueError(null);
      stop();
      try {
        const res = await fetch("/api/continue-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            selectedChoice: choiceText,
            fromChapterNumber: chapterNumber,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setContinueError(data.error || "Could not continue story.");
          if (readingMode === "read_to_me") setShowChoices(true);
          return;
        }
        const nextUrl =
          readingMode === "read_to_me"
            ? `/story/${storyId}?ch=${data.chapterNumber}&autoplay=1`
            : `/story/${storyId}?ch=${data.chapterNumber}`;
        router.push(nextUrl);
        router.refresh();
      } catch {
        setContinueError("Network issue while continuing story.");
        if (readingMode === "read_to_me") setShowChoices(true);
      } finally {
        setContinueLoading(false);
      }
    },
    [canContinue, continueLoading, stop, storyId, chapterNumber, router, readingMode]
  );

  return (
    <div className="min-h-dvh bg-parchment pb-40">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-full border border-[#d8c2a0] bg-white/75 px-4 py-2 text-base font-medium text-wood shadow-sm transition hover:bg-white"
          >
            ← Library
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d8c2a0] bg-white/80 px-4 py-2 text-sm font-medium text-wood shadow-sm">
              {readingMode === "read_to_me" ? "Read to me" : "I read myself"}
            </span>
            <div className="flex items-center gap-2 rounded-full border border-[#d8c2a0] bg-white/80 px-2 py-1 shadow-sm">
              <button
                type="button"
                onClick={() => bumpFont(-2)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-wood hover:bg-parchment"
                aria-label="Smaller text"
              >
                A−
              </button>
              <span className="min-w-[3ch] text-center text-sm font-medium text-ink/80">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => bumpFont(2)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-wood hover:bg-parchment"
                aria-label="Larger text"
              >
                A+
              </button>
            </div>
          </div>
        </div>

        <header className="panel mb-6 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wood/70">
            {storyTitle}
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold text-ink sm:text-5xl">
            {chapterTitle}
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            Chapter {chapterNumber}{" "}
            {chapterNumber !== currentChapterNumber ? "(history view)" : "(current chapter)"}
          </p>
        </header>

        <div className="panel mb-6 p-4">
          <p className="mb-2 text-sm font-semibold text-wood">Chapter navigation</p>
          <div className="flex flex-wrap gap-2">
            {chapterList.map((c) => (
              <Link
                key={c.chapterNumber}
                href={`/story/${storyId}?ch=${c.chapterNumber}`}
                className={`min-h-[40px] rounded-lg border px-3 py-2 text-sm ${
                  c.chapterNumber === chapterNumber
                    ? "border-teal bg-teal/10 text-wood"
                    : "border-wood/20 bg-parchment text-ink hover:border-gold"
                }`}
              >
                {c.chapterNumber}
              </Link>
            ))}
          </div>
        </div>

        <div className="panel mb-6 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-wood">Reading settings</p>
              <p className="mt-1 text-sm text-ink/70">
                Changes apply to the next generated chapter.
              </p>
            </div>
            {settingsMessage && (
              <p className="text-sm font-medium text-teal">{settingsMessage}</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleReadingModeChange("read_to_me")}
              disabled={settingsSaving}
              className={`min-h-[42px] rounded-full border px-4 text-sm ${
                readingModeSetting === "read_to_me"
                  ? "border-teal bg-teal/10 text-wood"
                  : "border-wood/20 bg-parchment text-ink"
              }`}
            >
              Read to me
            </button>
            <button
              type="button"
              onClick={() => handleReadingModeChange("read_myself")}
              disabled={settingsSaving}
              className={`min-h-[42px] rounded-full border px-4 text-sm ${
                readingModeSetting === "read_myself"
                  ? "border-teal bg-teal/10 text-wood"
                  : "border-wood/20 bg-parchment text-ink"
              }`}
            >
              I&apos;ll read it myself
            </button>
          </div>
          {readingModeSetting === "read_myself" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["easy", "medium", "advanced", "challenge"] as ReadingLevelKey[]).map(
                (level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleReadingLevelChange(level)}
                    disabled={settingsSaving}
                    className={`min-h-[40px] rounded-full border px-3 text-sm capitalize ${
                      readingLevelSetting === level
                        ? "border-teal bg-teal/10 text-wood"
                        : "border-wood/20 bg-parchment text-ink"
                    }`}
                  >
                    {level}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <div className="soft-shadow mb-8 overflow-hidden rounded-[1.75rem] border border-[#d7bf96] bg-white/70">
          {illustrationUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={illustrationUrl}
              alt=""
              className="h-auto w-full max-h-[min(50vh,420px)] object-cover"
            />
          ) : (
            <div className="flex min-h-[180px] items-center justify-center bg-gradient-to-br from-[#6a4328]/18 to-[#fff8f0] px-4 py-10 text-center text-ink/60">
              Illustration will appear here when images are turned on (Phase 5).
            </div>
          )}
        </div>

        <div className="panel soft-shadow px-4 py-3 sm:px-6 sm:py-5">
          <HighlightedText
            fullText={content}
            fontSizePx={fontSize}
            playback={playback}
            currentWordIndex={currentWordIndex}
          />
        </div>

        {showChoices && (
          <>
            {!canContinue && (
              <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You are viewing an earlier chapter. Jump to chapter {currentChapterNumber} to
                continue this story.
              </p>
            )}
            <ChoiceCards
              choices={choices}
              onChoose={handleChoose}
              loading={continueLoading}
            />
            {continueError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
                {continueError}
              </p>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t-2 border-gold/40 bg-parchment/95 px-3 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="mx-auto max-w-measure">
          {readingMode === "read_to_me" && needsUserGesture && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center sm:px-4">
              <p className="text-sm font-medium text-amber-950">
                Tap the big button to start the narrator (iPad sometimes blocks auto-play).
              </p>
              <button
                type="button"
                className="primary-button mt-3 min-h-[52px] w-full max-w-sm touch-manipulation text-base"
                onClick={() => {
                  dismissAutoplayBlock();
                  void speak();
                }}
              >
                Start narration
              </button>
            </div>
          )}
          <AudioControls
            playback={playback}
            isSpeaking={isSpeaking}
            isPaused={isPaused}
            rate={rate}
            onRateChange={handleRateChange}
            onPlay={speak}
            onPause={pause}
            onResume={resume}
            onRestart={handleRestart}
            speechError={speechError}
            voices={voices}
            voiceURI={voiceURI}
            onVoiceURI={handleVoiceURI}
            isLoadingAudio={isLoadingAudio}
          />
        </div>
      </div>
    </div>
  );
}
