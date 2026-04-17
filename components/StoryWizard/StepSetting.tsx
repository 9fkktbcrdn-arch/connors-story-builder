"use client";

type Props = {
  setting: string;
  mood: string;
  extraRules: string;
  onSetting: (v: string) => void;
  onMood: (v: string) => void;
  onExtraRules: (v: string) => void;
};

const MOODS = [
  "Funny",
  "Scary (kid-friendly)",
  "Mysterious",
  "Epic adventure",
  "Cozy",
  "Surprising",
];

export function StepSetting({
  setting,
  mood,
  extraRules,
  onSetting,
  onMood,
  onExtraRules,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Set the scene</h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Define location and tone for the story.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="setting">
          Where does the story take place?
        </label>
        <input
          id="setting"
          value={setting}
          onChange={(e) => onSetting(e.target.value)}
          className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
          placeholder="e.g. U.S. Army forward operating base in a mountain province; suburban high school; near-Earth orbit research station..."
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-600">Mood</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMood(mood === m ? "" : m)}
              className={`min-h-[38px] rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                mood === m
                  ? "border-blue-500 bg-blue-50 text-slate-800"
                  : "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="rules">
          Special rules (optional)
        </label>
        <textarea
          id="rules"
          value={extraRules}
          onChange={(e) => onExtraRules(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
          placeholder="e.g. Stick to realistic military gear and procedures; no supernatural elements; humor is dry, not slapstick..."
        />
      </div>
    </div>
  );
}
