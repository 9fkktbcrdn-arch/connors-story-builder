import type { WordRange } from "@/lib/reader/tokenize";

/** Cumulative "speech weight" per word — longer tokens get more relative time (TTS heuristic). */
export function buildWordSpeechWeights(ranges: WordRange[]): {
  cumulative: number[];
  total: number;
} {
  if (ranges.length === 0) return { cumulative: [], total: 1 };
  const raw = ranges.map((r) => {
    const len = Math.max(r.end - r.start, 1);
    return Math.pow(len, 0.62);
  });
  const cumulative: number[] = [];
  let sum = 0;
  for (const w of raw) {
    sum += w;
    cumulative.push(sum);
  }
  return { cumulative, total: sum > 0 ? sum : 1 };
}

/** Map audio progress [0,1] to word index using weighted timeline (closer sync than linear chars). */
export function wordIndexAtWeightedProgress(
  cumulative: number[],
  total: number,
  progress: number
): number {
  if (cumulative.length === 0) return 0;
  const p = Math.max(0, Math.min(1, progress));
  const target = p * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumulative[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
