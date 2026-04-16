export type WordRange = { index: number; start: number; end: number };

/** Character offsets for each word token in `fullText` (matches SpeechSynthesisUtterance text). */
export function buildWordRanges(fullText: string): WordRange[] {
  const ranges: WordRange[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(fullText)) !== null) {
    ranges.push({ index: idx++, start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

export type ParagraphSlice = { text: string; start: number; end: number };

export function splitParagraphSlices(content: string): ParagraphSlice[] {
  const slices: ParagraphSlice[] = [];
  const re = /\n\n+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      slices.push({
        text: content.slice(last, m.index),
        start: last,
        end: m.index,
      });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    slices.push({
      text: content.slice(last),
      start: last,
      end: content.length,
    });
  }
  if (slices.length === 0 && content.length > 0) {
    slices.push({ text: content, start: 0, end: content.length });
  }
  return slices;
}

export function findWordIndexAtChar(ranges: WordRange[], charIndex: number): number {
  if (ranges.length === 0) return 0;
  for (let i = 0; i < ranges.length; i++) {
    if (charIndex >= ranges[i].start && charIndex < ranges[i].end) return i;
  }
  let best = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges[i].start <= charIndex) best = i;
  }
  return best;
}

export type TextSegment =
  | { kind: "space"; text: string; start: number; end: number }
  | { kind: "word"; text: string; wordIndex: number; start: number; end: number };

/** Ordered segments (words + whitespace) with absolute offsets for rendering. */
export function buildSegments(fullText: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /(\s+)|(\S+)/g;
  let m: RegExpExecArray | null;
  let wi = 0;
  while ((m = re.exec(fullText)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (m[1]) {
      segments.push({ kind: "space", text: m[1], start, end });
    } else {
      segments.push({
        kind: "word",
        text: m[0],
        wordIndex: wi++,
        start,
        end,
      });
    }
  }
  return segments;
}

export function segmentsForParagraph(
  segments: TextSegment[],
  para: ParagraphSlice
): TextSegment[] {
  return segments.filter((s) => s.start >= para.start && s.start < para.end);
}
