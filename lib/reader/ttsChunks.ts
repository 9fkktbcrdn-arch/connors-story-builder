import type { WordRange } from "@/lib/reader/tokenize";

/** Contiguous slice of `fullText` aligned to word boundaries for TTS + highlighting. */
export type TtsChunkSpan = {
  startChar: number;
  endChar: number;
  text: string;
  firstWordIndex: number;
  lastWordIndex: number;
};

const DEFAULT_MAX_CHARS = 420;

/**
 * Pack words into chunks under `maxChars` (character span from first to last word).
 * Short per-chunk audio makes time→word mapping much closer to perceived speech than one long file.
 */
export function buildTtsChunksFromWordRanges(
  fullText: string,
  ranges: WordRange[],
  maxChars: number = DEFAULT_MAX_CHARS
): TtsChunkSpan[] {
  if (!fullText.trim()) return [];
  if (ranges.length === 0) {
    return [
      {
        startChar: 0,
        endChar: fullText.length,
        text: fullText,
        firstWordIndex: 0,
        lastWordIndex: 0,
      },
    ];
  }

  const chunks: TtsChunkSpan[] = [];
  let i = 0;
  while (i < ranges.length) {
    const startChar = ranges[i]!.start;
    let j = i;
    while (
      j + 1 < ranges.length &&
      ranges[j + 1]!.end - startChar <= maxChars
    ) {
      j++;
    }
    const endChar = ranges[j]!.end;
    chunks.push({
      startChar,
      endChar,
      text: fullText.slice(startChar, endChar),
      firstWordIndex: i,
      lastWordIndex: j,
    });
    i = j + 1;
  }
  return chunks;
}
