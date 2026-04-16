import type { ReadingLevelKey, WizardPayload } from "@/types/story";

export function mapLevelForPrompt(level: ReadingLevelKey): string {
  switch (level) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "advanced":
      return "advanced";
    case "challenge":
      return "adult";
    default:
      return "advanced";
  }
}

export function buildFirstChapterSystemPrompt(payload: WizardPayload): string {
  const {
    premise,
    characters,
    setting,
    mood,
    extraRules,
    readingMode,
    readingLevel,
  } = payload;
  const effectiveLevel =
    readingMode === "read_to_me" ? "adult" : mapLevelForPrompt(readingLevel);

  const chars = characters
    .filter((c) => c.name.trim())
    .map((c) => `${c.name}${c.type ? ` (${c.type})` : ""}: ${c.description}`)
    .join("\n");

  return `You are a master storyteller creating an interactive, branching adventure story.

Story context:
- Premise: ${premise}
- Characters:
${chars || "(none specified)"}
- Setting: ${setting || "Not specified"}
- Mood: ${mood || "Not specified"}
- Extra rules: ${extraRules || "None"}
- Reading level: ${effectiveLevel}

Rules:
1. Write in second person ("You step into the cave...") to make it immersive
2. Keep chapters SHORT — approximately 300-500 words (about 2-3 minutes of reading)
3. Break text into short paragraphs (2-3 sentences each) for readability
4. End each chapter on a moment of tension, wonder, or decision
5. After the chapter text, provide exactly 3 choices for what happens next
6. Each choice should lead to a MEANINGFULLY different story direction
7. This is chapter 1 — establish the world and hook the reader
8. If reading level is "easy" — use simple vocabulary, short sentences, common words
9. If reading level is "medium" — use moderate vocabulary, varied sentence structure
10. If reading level is "advanced" or "adult" — use rich vocabulary, vivid descriptions, complex but clear sentences
11. Also provide a 2-sentence summary of this chapter (for context management)
12. Also provide a short image prompt describing the key visual scene of this chapter (for DALL-E illustration)

Respond in this exact JSON format only, no markdown:
{
  "storyTitle": "Short exciting book title",
  "chapterTitle": "The Cavern of Echoes",
  "content": "The full chapter text here...",
  "summary": "Brief 2-sentence summary of what happened.",
  "imagePrompt": "A description of the key scene for illustration",
  "choices": [
    {"id": 1, "text": "Follow the glowing footprints deeper into the cave"},
    {"id": 2, "text": "Call out to the mysterious voice echoing from above"},
    {"id": 3, "text": "Turn back and search for another entrance"}
  ]
}`;
}

type ContinuationContext = {
  premise: string;
  characters: unknown;
  setting: string | null;
  mood: string | null;
  extraRules: string | null;
  readingMode: "read_to_me" | "read_myself";
  readingLevel: ReadingLevelKey;
  chapterSummaries: string[];
  recentChapterTexts: { chapterNumber: number; title: string; content: string }[];
  selectedChoice: string;
};

export function buildContinuationSystemPrompt(ctx: ContinuationContext): string {
  const effectiveLevel =
    ctx.readingMode === "read_to_me" ? "adult" : mapLevelForPrompt(ctx.readingLevel);

  return `You are a master storyteller creating an interactive, branching adventure story.

Story context:
- Premise: ${ctx.premise}
- Characters: ${JSON.stringify(ctx.characters)}
- Setting: ${ctx.setting || "Not specified"}
- Mood: ${ctx.mood || "Not specified"}
- Extra rules: ${ctx.extraRules || "None"}
- Reading level: ${effectiveLevel}

Rules:
1. Write in second person ("You step into the cave...") to make it immersive
2. Keep chapters SHORT — approximately 300-500 words
3. Break text into short paragraphs (2-3 sentences each)
4. Continue naturally from prior chapters while honoring continuity
5. End on a moment of tension, wonder, or decision
6. Provide exactly 3 meaningfully different choices for what happens next
7. If reading level is "easy" — simple vocabulary and short sentences
8. If reading level is "medium" — moderate vocabulary and varied sentence structure
9. If reading level is "advanced" or "adult" — rich vocabulary and vivid descriptions
10. Also provide a 2-sentence summary of this chapter
11. Also provide a short image prompt describing the key visual scene

Respond in this exact JSON format only, no markdown:
{
  "chapterTitle": "The Cavern of Echoes",
  "content": "The full chapter text here...",
  "summary": "Brief 2-sentence summary of what happened.",
  "imagePrompt": "A description of the key scene for illustration",
  "choices": [
    {"id": 1, "text": "Follow the glowing footprints deeper into the cave"},
    {"id": 2, "text": "Call out to the mysterious voice echoing from above"},
    {"id": 3, "text": "Turn back and search for another entrance"}
  ]
}`;
}

export function buildContinuationUserPrompt(ctx: ContinuationContext): string {
  const summaries = ctx.chapterSummaries.length
    ? ctx.chapterSummaries.map((s, i) => `Chapter ${i + 1} summary: ${s}`).join("\n")
    : "No earlier summaries.";

  const recents = ctx.recentChapterTexts
    .map(
      (c) =>
        `Chapter ${c.chapterNumber}: ${c.title}\n${c.content}`
    )
    .join("\n\n---\n\n");

  return `Previous chapter summaries:
${summaries}

Recent full chapter text:
${recents}

Selected choice:
${ctx.selectedChoice}

Continue the story based on that selected choice. Return JSON only.`;
}
