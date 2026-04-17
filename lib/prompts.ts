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

Creativity and variety (critical):
- Every story must feel distinct. Invent imagery, stakes, and obstacles from the premise, setting, mood, and characters above.
- **Follow the reader's world:** Match whatever genre the premise and setting imply—fantasy, medieval, dragons, fairy tales, science fiction, mystery, sports, historical, contemporary, military, etc. Do not import a different genre on top of the user's idea (e.g. no random sorcerers in a straight military drama; no courtroom drama beats in a dragon quest unless the premise invites it).
- Optional character tags (Hero, Knight, Dragon, etc.) are loose hints—interpret them in the story's actual setting (a "Knight" in a space-opera might be a sworn protector, not plate armor, unless that fits).
- Do NOT lean on tired clichés unless they truly fit. Avoid overused motifs such as: glowing footprints/trails, disembodied whispers, "strange symbols" on walls, generic riddling doors, or "an ancient evil awakening" as a default crutch.
- Do NOT copy or paraphrase any example JSON strings you may have seen in other instructions—those are structural templates only, not story content.
- Choices must branch the plot in clearly different directions (tone, risk, location, or alliance)—not three flavors of the same next beat.

Rules:
1. Write in second person ("You ...") for immersion. Open scenes in ways that fit this story, not a generic template.
2. Keep chapters SHORT — target about **280–400 words** when it still feels complete (snappier listen, lower cost); hard cap around 500 words
3. Break text into short paragraphs (2-3 sentences each) for readability
4. End each chapter on a moment of tension, wonder, or decision
5. After the chapter text, provide exactly 3 choices for what happens next
6. Each choice must be one short imperative line the reader can tap (no numbering inside the text field)
7. This is chapter 1 — establish the world and hook the reader in a way that matches the premise, not a default template
8. If reading level is "easy" — use simple vocabulary, short sentences, common words
9. If reading level is "medium" — use moderate vocabulary, varied sentence structure
10. If reading level is "advanced" or "adult" — use rich vocabulary, vivid descriptions, complex but clear sentences
11. Also provide a 2-sentence summary of this chapter (for context management)
12. Also provide a short image prompt describing the key visual scene of this chapter (for DALL-E illustration)

Respond in this exact JSON shape only (replace ALL string values with your own original content—no placeholders from this message), no markdown:
{
  "storyTitle": "string",
  "chapterTitle": "string",
  "content": "string",
  "summary": "string",
  "imagePrompt": "string",
  "choices": [
    {"id": 1, "text": "string"},
    {"id": 2, "text": "string"},
    {"id": 3, "text": "string"}
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
- Extra rules: ${ctx.extraRules || "Not specified"}
- Reading level: ${effectiveLevel}

Creativity and variety (critical):
- Continue in a way that honors the SELECTED CHOICE and prior chapters, but keep inventing fresh specifics—do not default to a single "stock adventure" plot.
- **Stay in the story's world:** Keep the same genre and tone the reader already chose (fantasy, dragon tales, sci‑fi, mystery, military, contemporary, etc.). Do not suddenly introduce a different genre's default tropes unless the plot naturally earns it.
- Optional character tags are hints only—keep them consistent with the established setting.
- Avoid repeating the same magical motif in chapter after chapter (e.g. glowing trails, footprints, disembodied voices) unless the user or prior text explicitly established it.
- Do NOT copy example JSON strings from instructions—only output your own original text in the required shape.
- The three next choices must diverge meaningfully (not three near-synonyms).

Rules:
1. Write in second person ("You ..."). Match voice to mood and setting.
2. Keep chapters SHORT — target about **280–400 words** when it still feels complete; hard cap around 500 words
3. Break text into short paragraphs (2-3 sentences each)
4. Continue naturally from prior chapters while honoring continuity and the selected choice
5. End on a moment of tension, wonder, or decision
6. Provide exactly 3 distinct choices as short imperative lines
7. If reading level is "easy" — simple vocabulary and short sentences
8. If reading level is "medium" — moderate vocabulary and varied sentence structure
9. If reading level is "advanced" or "adult" — rich vocabulary and vivid descriptions
10. Also provide a 2-sentence summary of this chapter
11. Also provide a short image prompt describing the key visual scene

Respond in this exact JSON shape only (all string values must be your own original content), no markdown:
{
  "chapterTitle": "string",
  "content": "string",
  "summary": "string",
  "imagePrompt": "string",
  "choices": [
    {"id": 1, "text": "string"},
    {"id": 2, "text": "string"},
    {"id": 3, "text": "string"}
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

Selected choice (follow this path; do not ignore it):
${ctx.selectedChoice}

Continue the story based on that selected choice. Return JSON only.`;
}
