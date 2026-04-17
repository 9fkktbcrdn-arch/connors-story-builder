/**
 * Optional role tags for characters — genre-neutral (military, contemporary, sci‑fi, sports, etc.).
 * Not fantasy-specific; the model should follow the premise and setting for actual genre.
 */
export const CHARACTER_TYPES = [
  { id: "leader", label: "Leader" },
  { id: "specialist", label: "Specialist" },
  { id: "teammate", label: "Teammate" },
  { id: "mentor", label: "Mentor" },
  { id: "adversary", label: "Adversary" },
  { id: "civilian", label: "Civilian" },
  { id: "rookie", label: "Rookie" },
  { id: "other", label: "Other" },
] as const;
