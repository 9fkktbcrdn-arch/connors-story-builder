"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildWordSpeechWeights,
  wordIndexAtWeightedProgress,
} from "@/lib/reader/highlightProgress";
import {
  buildTtsChunksFromWordRanges,
  type TtsChunkSpan,
} from "@/lib/reader/ttsChunks";
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

type ChunkAudioCache = Map<string, Blob>;

function cacheKey(
  chunkIdx: number,
  voice: string,
  rate: number,
  text: string
): string {
  return `${chunkIdx}|${voice}|${rate}|${text.length}|${text.slice(0, 80)}`;
}

export function useOpenAITts(fullText: string, rate: number, voice: string) {
  const [playback, setPlayback] = useState<SpeechPlayback>("idle");
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const blobCacheRef = useRef<ChunkAudioCache>(new Map());
  const opIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const chunkIndexRef = useRef(0);
  const chunksRef = useRef<TtsChunkSpan[]>([]);
  const wordRangesRef = useRef<WordRange[]>([]);
  const chunkMetaRef = useRef<
    {
      cumulative: number[];
      total: number;
      firstWordIndex: number;
      lastWordIndex: number;
    }[]
  >([]);

  const playChunkAtIndexRef = useRef<
    (chunkIdx: number, seekFrac: number | null, myOp: number) => Promise<void>
  >(async () => {});

  const wordRanges = useMemo(() => buildWordRanges(fullText), [fullText]);
  const chunks = useMemo(
    () => buildTtsChunksFromWordRanges(fullText, wordRanges),
    [fullText, wordRanges]
  );

  useLayoutEffect(() => {
    chunksRef.current = chunks;
    wordRangesRef.current = wordRanges;
    chunkMetaRef.current = chunks.map((ch) => {
      const slice = wordRanges.slice(
        ch.firstWordIndex,
        ch.lastWordIndex + 1
      );
      const { cumulative, total } = buildWordSpeechWeights(slice);
      return {
        cumulative,
        total,
        firstWordIndex: ch.firstWordIndex,
        lastWordIndex: ch.lastWordIndex,
      };
    });
  }, [chunks, wordRanges]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const cleanupCurrentAudio = useCallback(() => {
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

  const updateHighlightForCurrentChunk = useCallback(() => {
    const audio = audioRef.current;
    const idx = chunkIndexRef.current;
    const meta = chunkMetaRef.current[idx];
    const ch = chunksRef.current[idx];
    if (!audio || !meta || !ch) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration || duration <= 0) return;

    const progress = Math.max(0, Math.min(1, audio.currentTime / duration));
    const localIdx = wordIndexAtWeightedProgress(
      meta.cumulative,
      meta.total,
      progress
    );
    const globalIdx = Math.min(
      ch.lastWordIndex,
      ch.firstWordIndex + localIdx
    );
    setCurrentWordIndex(globalIdx);
  }, []);

  const startRafLoop = useCallback(() => {
    stopRaf();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) {
        rafRef.current = null;
        return;
      }
      updateHighlightForCurrentChunk();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf, updateHighlightForCurrentChunk]);

  /** New chapter or new voice/rate: invalidate playback and TTS cache. */
  useLayoutEffect(() => {
    opIdRef.current += 1;
    chunkIndexRef.current = 0;
    cleanupCurrentAudio();
    blobCacheRef.current = new Map();
    setPlayback("idle");
    setCurrentWordIndex(null);
    setSpeechError(null);
    setIsLoadingAudio(false);
  }, [fullText, voice, rate, cleanupCurrentAudio]);

  const fetchChunkBlob = useCallback(
    async (text: string, myOp: number): Promise<Blob> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice,
          speed: rate,
        }),
      });
      if (myOp !== opIdRef.current) {
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
      return res.blob();
    },
    [rate, voice]
  );

  const playChunkAtIndex = useCallback(
    async (chunkIdx: number, seekFrac: number | null, myOp: number) => {
      if (myOp !== opIdRef.current) return;

      const list = chunksRef.current;
      if (chunkIdx >= list.length || list.length === 0) {
        setPlayback("ended");
        setCurrentWordIndex(null);
        return;
      }

      chunkIndexRef.current = chunkIdx;
      const ch = list[chunkIdx]!;
      const key = cacheKey(chunkIdx, voice, rate, ch.text);
      let blob = blobCacheRef.current.get(key);
      if (!blob) {
        setIsLoadingAudio(true);
        try {
          blob = await fetchChunkBlob(ch.text, myOp);
        } finally {
          setIsLoadingAudio(false);
        }
        if (myOp !== opIdRef.current) return;
        blobCacheRef.current.set(key, blob);
      } else if (myOp !== opIdRef.current) {
        return;
      }

      cleanupCurrentAudio();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = "auto";
      audioUrlRef.current = url;
      audioRef.current = audio;

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
        if (myOp !== opIdRef.current) return;
        void playChunkAtIndexRef.current(chunkIdx + 1, null, myOp);
      };
      audio.onerror = () => {
        stopRaf();
        setPlayback("idle");
        setSpeechError("Narration audio failed. Try play again.");
      };

      const startPlayback = async () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        if (duration > 0 && seekFrac !== null) {
          audio.currentTime = Math.max(
            0,
            Math.min(duration * 0.999, seekFrac * duration)
          );
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
    },
    [cleanupCurrentAudio, fetchChunkBlob, startRafLoop, stopRaf, rate, voice]
  );

  playChunkAtIndexRef.current = playChunkAtIndex;

  const speak = useCallback(async () => {
    const myOp = ++opIdRef.current;
    setSpeechError(null);
    chunkIndexRef.current = 0;
    cleanupCurrentAudio();
    try {
      await playChunkAtIndex(0, null, myOp);
    } catch (e) {
      if (e instanceof Error && e.message.includes("replaced")) return;
      setIsLoadingAudio(false);
      setPlayback("idle");
      setSpeechError(
        e instanceof Error ? e.message : "Could not play narration."
      );
    }
  }, [cleanupCurrentAudio, playChunkAtIndex]);

  const getProgress = useCallback(() => {
    const list = chunksRef.current;
    const total = wordRangesRef.current.length;
    if (!total || list.length === 0) return 0;

    const idx = Math.min(chunkIndexRef.current, list.length - 1);
    const ch = list[idx]!;
    const audio = audioRef.current;
    const wordsBefore = ch.firstWordIndex;
    const wordsInChunk = ch.lastWordIndex - ch.firstWordIndex + 1;

    let localFrac = 0;
    if (audio) {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (duration > 0) {
        localFrac = Math.max(0, Math.min(1, audio.currentTime / duration));
      }
    }

    const wordsPlayed = wordsBefore + localFrac * Math.max(1, wordsInChunk);
    return Math.max(0, Math.min(1, wordsPlayed / total));
  }, []);

  const seekAndPlay = useCallback(
    async (progress: number) => {
      const myOp = ++opIdRef.current;
      const list = chunksRef.current;
      const total = wordRangesRef.current.length;
      if (!total || list.length === 0) return;

      const p = Math.max(0, Math.min(1, progress));
      const targetWord = p * Math.max(0, total - 1);

      let chunkIdx = 0;
      for (let i = 0; i < list.length; i++) {
        const c = list[i]!;
        if (c.firstWordIndex <= targetWord && targetWord <= c.lastWordIndex) {
          chunkIdx = i;
          break;
        }
        if (c.lastWordIndex < targetWord) chunkIdx = i;
      }

      const ch = list[chunkIdx]!;
      const wordsInChunk = ch.lastWordIndex - ch.firstWordIndex + 1;
      const seekFrac =
        wordsInChunk <= 1
          ? 0
          : (targetWord - ch.firstWordIndex) / (wordsInChunk - 1);

      setSpeechError(null);
      cleanupCurrentAudio();
      try {
        await playChunkAtIndex(chunkIdx, seekFrac, myOp);
      } catch (e) {
        if (e instanceof Error && e.message.includes("replaced")) return;
        setIsLoadingAudio(false);
        setPlayback("idle");
        setSpeechError(
          e instanceof Error ? e.message : "Could not play narration."
        );
      }
    },
    [cleanupCurrentAudio, playChunkAtIndex]
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
    opIdRef.current += 1;
    stopRaf();
    if (!audioRef.current) {
      setPlayback("idle");
      setCurrentWordIndex(null);
      chunkIndexRef.current = 0;
      return;
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlayback("idle");
    setCurrentWordIndex(null);
    chunkIndexRef.current = 0;
  }, [stopRaf]);

  useLayoutEffect(() => {
    return () => {
      opIdRef.current += 1;
      stopRaf();
      cleanupCurrentAudio();
      blobCacheRef.current.clear();
    };
  }, [cleanupCurrentAudio, stopRaf]);

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
