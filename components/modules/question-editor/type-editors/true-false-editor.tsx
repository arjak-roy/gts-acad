"use client";

const TRUE_FALSE_OPTIONS = [
  { label: "True", value: true, description: "Learners should confirm this statement is correct." },
  { label: "False", value: false, description: "Learners should identify this statement as incorrect." },
] as const;

export function TrueFalseEditor({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-semibold">Correct Answer</label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose whether the statement should be treated as true or false.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {TRUE_FALSE_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              className={`rounded-xl border-2 px-5 py-5 text-left transition-all ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50/80 shadow-sm shadow-emerald-100"
                  : "border-border bg-background hover:border-primary/30 hover:bg-muted/30"
              }`}
              onClick={() => onChange(option.value)}
            >
              <span className={`block text-base font-bold ${isSelected ? "text-emerald-700" : "text-foreground"}`}>
                {option.label}
              </span>
              <span className="mt-1.5 block text-xs text-muted-foreground leading-relaxed">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
