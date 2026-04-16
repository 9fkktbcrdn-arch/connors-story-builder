"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWordRanges,
  findWordIndexAtChar,
  type WordRange,
} from "@/lib/reader/tokenize";

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

  const getProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return 0;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration || duration <= 0) return 0;
    return Math.max(0, Math.min(1, audio.currentTime / duration));
  }, []);

  const wordRanges = useMemo(() => buildWordRanges(fullText), [fullText]);
  useEffect(() => {
    rangesRef.current = wordRanges;
  }, [wordRanges]);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.ontimeupdate = null;
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
  }, []);

  const attachAudio = useCallback(
    (audio: HTMLAudioElement) => {
      audio.ontimeupdate = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        if (!duration || duration <= 0) return;
        const progress = Math.max(0, Math.min(1, audio.currentTime / duration));
        const estCharIndex = Math.floor(progress * Math.max(0, fullText.length - 1));
        const idx = findWordIndexAtChar(rangesRef.current, estCharIndex);
        setCurrentWordIndex(idx);
      };
      audio.onpause = () => {
        // On ended, onended will run and set explicit ended state.
        if (!audio.ended) setPlayback("paused");
      };
      audio.onplay = () => setPlayback("speaking");
      audio.onended = () => {
        setPlayback("ended");
        setCurrentWordIndex(null);
      };
      audio.onerror = () => {
        setPlayback("idle");
        setSpeechError("Narration audio failed. Try play again.");
      };
    },
    [fullText.length]
  );

  const ensureAudio = useCallback(async () => {
    const key = `${voice}|${rate}|${fullText}`;
    if (audioRef.current && audioKeyRef.current === key) return audioRef.current;

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
    if (!audioRef.current) {
      setPlayback("idle");
      setCurrentWordIndex(null);
      return;
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlayback("idle");
    setCurrentWordIndex(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

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

