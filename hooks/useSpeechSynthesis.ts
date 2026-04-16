"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWordRanges,
  findWordIndexAtChar,
  type WordRange,
} from "@/lib/reader/tokenize";

export type SpeechPlayback = "idle" | "speaking" | "paused" | "ended";

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const prefer = [
    "Samantha",
    "Google UK English Female",
    "Karen",
    "Daniel",
    "Google US English",
    "Microsoft Aria",
  ];
  for (const name of prefer) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  return en[0] ?? voices[0] ?? null;
}

export function useSpeechSynthesis(fullText: string, rate: number, voiceURI?: string) {
  const wordRanges = useMemo(() => buildWordRanges(fullText), [fullText]);
  const rateRef = useRef(rate);
  const voiceURIRef = useRef(voiceURI);
  const [playback, setPlayback] = useState<SpeechPlayback>("idle");
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const rangesRef = useRef<WordRange[]>(wordRanges);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    voiceURIRef.current = voiceURI;
  }, [voiceURI]);

  useEffect(() => {
    rangesRef.current = wordRanges;
  }, [wordRanges]);

  const refreshVoices = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    voicesRef.current = window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    refreshVoices();
    const onVoices = () => refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
  }, [refreshVoices]);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSpeechError("Speech is not available in this browser.");
      return;
    }
    if (!fullText.trim()) return;

    setSpeechError(null);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = "en-US";
    utterance.rate = rateRef.current;
    const voices = window.speechSynthesis.getVoices();
    const pool = voices.length ? voices : voicesRef.current;
    let voice: SpeechSynthesisVoice | null = null;
    if (voiceURIRef.current) {
      voice = pool.find((v) => v.voiceURI === voiceURIRef.current) ?? null;
    }
    if (!voice) voice = pickEnglishVoice(pool);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setPlayback("speaking");
    };

    utterance.onboundary = (event) => {
      if (typeof event.charIndex !== "number") return;
      const idx = findWordIndexAtChar(rangesRef.current, event.charIndex);
      setCurrentWordIndex(idx);
    };

    utterance.onpause = () => {
      setPlayback("paused");
    };

    utterance.onresume = () => {
      setPlayback("speaking");
    };

    utterance.onend = () => {
      utteranceRef.current = null;
      setPlayback("ended");
      setCurrentWordIndex(null);
    };

    utterance.onerror = (e) => {
      utteranceRef.current = null;
      setPlayback("idle");
      setCurrentWordIndex(null);
      if (e.error !== "canceled" && e.error !== "interrupted") {
        setSpeechError("Read-aloud hit a snag. You can still read the text.");
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [fullText]);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setPlayback("idle");
    setCurrentWordIndex(null);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const isSpeaking = playback === "speaking";
  const isPaused = playback === "paused";
  const hasFinished = playback === "ended";

  return {
    wordRanges,
    playback,
    isSpeaking,
    isPaused,
    hasFinished,
    currentWordIndex,
    speechError,
    speak,
    pause,
    resume,
    stop,
  };
}
