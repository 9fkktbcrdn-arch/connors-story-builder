"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** False when premise is empty — shows a hint to type first */
  canContinue: boolean;
};

export function StepPremise({ value, onChange, canContinue }: Props) {
  const startListening = () => {
    type RecCtor = new () => {
      lang: string;
      interimResults: boolean;
      start: () => void;
      onresult: ((e: { results: Iterable<{ 0?: { transcript?: string } }> }) => void) | null;
    };
    const w = window as unknown as {
      SpeechRecognition?: RecCtor;
      webkitSpeechRecognition?: RecCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript)
        .join(" ");
      if (text) onChange(value ? `${value.trim()} ${text}` : text);
    };
    rec.start();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          What is your story about?
        </h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Write a short premise. Keep it simple and specific.
        </p>
      </div>
      <label className="sr-only" htmlFor="premise">
        Story premise
      </label>
      <textarea
        id="premise"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        autoComplete="off"
        placeholder={
          "Example: A recon team must reach an extraction point before dawn — comms are down and someone on the inside may be compromised.\nOr: Two siblings find evidence their quiet town is covering up a dangerous industrial accident."
        }
        className="min-h-[10rem] w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {!canContinue && (
        <p className="text-sm text-slate-600" role="status">
          Type your idea above (even a short phrase), then tap <strong>Next</strong> at the
          bottom.
        </p>
      )}
      <button
        type="button"
        onClick={startListening}
        className="min-h-[40px] self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Use microphone (if supported)
      </button>
    </div>
  );
}
