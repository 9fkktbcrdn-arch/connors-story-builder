"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SpeechPlayback } from "@/hooks/useSpeechSynthesis";
import {
  buildSegments,
  segmentsForParagraph,
  splitParagraphSlices,
} from "@/lib/reader/tokenize";

type Props = {
  fullText: string;
  fontSizePx: number;
  playback: SpeechPlayback;
  currentWordIndex: number | null;
};

function wordClass(
  wordIndex: number,
  playback: SpeechPlayback,
  currentWordIndex: number | null
): string {
  const base =
    "rounded-sm px-0.5 transition-colors duration-150 ease-out align-baseline";
  if (playback === "ended") {
    return `${base} bg-read/50 text-ink/85`;
  }
  if (
    (playback === "speaking" || playback === "paused") &&
    currentWordIndex !== null
  ) {
    if (wordIndex === currentWordIndex) {
      return `${base} bg-highlight text-ink shadow-[0_0_12px_rgba(255,224,102,0.65)]`;
    }
    if (wordIndex < currentWordIndex) {
      return `${base} bg-read/60 text-ink/80`;
    }
  }
  return `${base} text-ink`;
}

export function HighlightedText({
  fullText,
  fontSizePx,
  playback,
  currentWordIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { paragraphs, segments } = useMemo(() => {
    const segments = buildSegments(fullText);
    const paragraphs = splitParagraphSlices(fullText);
    return { paragraphs, segments };
  }, [fullText]);

  useEffect(() => {
    if (currentWordIndex === null) return;
    const root = containerRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-read-word="${currentWordIndex}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentWordIndex]);

  return (
    <div
      ref={containerRef}
      className="story-body rounded-2xl px-2 py-6 sm:px-6"
      style={{
        fontSize: `${fontSizePx}px`,
        lineHeight: 1.9,
        maxWidth: "42rem",
      }}
    >
      {paragraphs.map((para, pi) => {
        const segs = segmentsForParagraph(segments, para);
        if (segs.length === 0) return null;
        return (
          <p key={pi} className="mb-6 last:mb-0">
            {segs.map((seg, si) => {
              if (seg.kind === "space") {
                return <span key={`${pi}-${si}-s`}>{seg.text}</span>;
              }
              return (
                <span
                  key={`${pi}-${si}-w`}
                  data-read-word={seg.wordIndex}
                  className={wordClass(
                    seg.wordIndex,
                    playback,
                    currentWordIndex
                  )}
                >
                  {seg.text}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
