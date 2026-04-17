"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildWordSpeechWeights,
  wordIndexAtWeightedProgress,
} from "@/lib/reader/highlightProgress";
import { buildWordRanges, type WordRange } from "@/lib/reader/tokenize";

export type SpeechPlayback = "idle" | "speaking" | "paused" | "ended";

export type TtsVoiceOption = {
  id: string;
  label: string;
};

const VOICES: TtsVoiceOption[] = [
  { id: "shimmer", label: "Shimmer" },
  { id: "nova", label: "Nova" },
  { id: "sage", label: "Sage" },
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
];

export function useOpenAITts(fullText: string, rate: number, voice: string) {
  const [playback, setPlayback] = useState<SpeechPlayback>("idle");
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioKeyRef = useRef<string>("");
  const rangesRef = useRef<WordRange[]>(buildWordRanges(fullText));
  const cumulativeRef = useRef<number[]>([]);
  const weightTotalRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const ensureGenRef = useRef(0);

  const wordRanges = useMemo(() => buildWordRanges(fullText), [fullText]);
  const { cumulative, total: weightTotal } = useMemo(
    () => buildWordSpeechWeights(wordRanges),
    [wordRanges]
  );

  useEffect(() => {
    rangesRef.current = wordRanges;
    cumulativeRef.current = cumulative;
    weightTotalRef.current = weightTotal;
  }, [wordRanges, cumulative, weightTotal]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const updateHighlightFromAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration || duration <= 0) return;
    const progress = Math.max(0, Math.min(1, audio.currentTime / duration));
    const idx = wordIndexAtWeightedProgress(
      cumulativeRef.current,
      weightTotalRef.current,
      progress
    );
    setCurrentWordIndex(idx);
  }, []);

  const startRafLoop = useCallback(() => {
    stopRaf();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) {
        rafRef.current = null;
        return;
      }
      updateHighlightFromAudio();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf, updateHighlightFromAudio]);

  const getProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return 0;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration || duration <= 0) return 0;
    return Math.max(0, Math.min(1, audio.currentTime / duration));
  }, []);

  const cleanupAudio = useCallback(() => {
    stopRaf();
    const audio = audioRef.current;
    if (audio) {
      audio.onpause = null;
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
    }
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, [stopRaf]);

  const attachAudio = useCallback(
    (audio: HTMLAudioElement) => {
      audio.onpause = () => {
        stopRaf();
        if (!audio.ended) setPlayback("paused");
      };
      audio.onplay = () => {
        setPlayback("speaking");
        startRafLoop();
      };
      audio.onended = () => {
        stopRaf();
        setPlayback("ended");
        setCurrentWordIndex(null);
      };
      audio.onerror = () => {
        stopRaf();
        setPlayback("idle");
        setSpeechError("Narration audio failed. Try play again.");
      };
    },
    [startRafLoop, stopRaf]
  );

  /** New chapter / navigation: reset before paint so autoplay and choice UI see a clean state. */
  useLayoutEffect(() => {
    ensureGenRef.current += 1;
    cleanupAudio();
    setPlayback("idle");
    setCurrentWordIndex(null);
    setSpeechError(null);
    setIsLoadingAudio(false);
    audioKeyRef.current = "";
  }, [fullText, cleanupAudio]);

  const ensureAudio = useCallback(async () => {
    const key = `${voice}|${rate}|${fullText}`;
    if (audioRef.current && audioKeyRef.current === key) return audioRef.current;

    const myGen = ++ensureGenRef.current;
    setIsLoadingAudio(true);
    setSpeechError(null);
    cleanupAudio();

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: fullText,
        voice,
        speed: rate,
      }),
    });
    if (myGen !== ensureGenRef.current) {
      setIsLoadingAudio(false);
      throw new Error("Narration was replaced by a newer request.");
    }
    if (!res.ok) {
      let msg = "Could not generate narration audio.";
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    if (myGen !== ensureGenRef.current) {
      setIsLoadingAudio(false);
      throw new Error("Narration was replaced by a newer request.");
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = "auto";
    audioUrlRef.current = url;
    audioRef.current = audio;
    audioKeyRef.current = key;
    attachAudio(audio);
    setIsLoadingAudio(false);
    return audio;
  }, [attachAudio, cleanupAudio, fullText, rate, voice]);

  const speak = useCallback(async () => {
    try {
      const audio = await ensureAudio();
      await audio.play();
    } catch (e) {
      setIsLoadingAudio(false);
      if (e instanceof Error && e.message.includes("replaced")) return;
      setPlayback("idle");
      setSpeechError(e instanceof Error ? e.message : "Could not play narration.");
    }
  }, [ensureAudio]);

  const seekAndPlay = useCallback(
    async (progress: number) => {
      try {
        const audio = await ensureAudio();
        const clamped = Math.max(0, Math.min(1, progress));
        const startPlayback = async () => {
          const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
          if (duration > 0) {
            audio.currentTime = clamped * duration;
          }
          await audio.play();
        };

        if (audio.readyState >= 1) {
          await startPlayback();
          return;
        }

        await new Promise<void>((resolve, reject) => {
          const onLoaded = async () => {
            cleanup();
            try {
              await startPlayback();
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          const onError = () => {
            cleanup();
            reject(new Error("Could not load narration audio."));
          };
          const cleanup = () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("error", onError);
          };
          audio.addEventListener("loadedmetadata", onLoaded, { once: true });
          audio.addEventListener("error", onError, { once: true });
        });
      } catch (e) {
        setIsLoadingAudio(false);
        if (e instanceof Error && e.message.includes("replaced")) return;
        setPlayback("idle");
        setSpeechError(e instanceof Error ? e.message : "Could not play narration.");
      }
    },
    [ensureAudio]
  );

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  }, []);

  const resume = useCallback(async () => {
    if (!audioRef.current) return speak();
    try {
      await audioRef.current.play();
    } catch {
      setSpeechError("Could not resume narration.");
    }
  }, [speak]);

  const stop = useCallback(() => {
    stopRaf();
    if (!audioRef.current) {
      setPlayback("idle");
      setCurrentWordIndex(null);
      return;
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlayback("idle");
    setCurrentWordIndex(null);
  }, [stopRaf]);

  useEffect(() => {
    return () => {
      stopRaf();
      cleanupAudio();
    };
  }, [cleanupAudio, stopRaf]);

  return {
    playback,
    isSpeaking: playback === "speaking",
    isPaused: playback === "paused",
    hasFinished: playback === "ended",
    currentWordIndex,
    speechError,
    isLoadingAudio,
    voices: VOICES,
    getProgress,
    speak,
    seekAndPlay,
    pause,
    resume,
    stop,
  };
}
