export type ReadingMode = "read_to_me" | "read_myself";

export type ReadingLevelKey = "easy" | "medium" | "advanced" | "challenge";

export type CharacterInput = {
  id: string;
  name: string;
  description: string;
  type: string | null;
};

export type WizardPayload = {
  premise: string;
  characters: CharacterInput[];
  setting: string;
  mood: string;
  extraRules: string;
  readingMode: ReadingMode;
  readingLevel: ReadingLevelKey;
};

export type GeneratedChapter = {
  storyTitle?: string;
  chapterTitle: string;
  content: string;
  summary: string;
  imagePrompt: string;
  choices: { id: number; text: string }[];
};

export type StoryChoice = {
  id: number;
  text: string;
};
