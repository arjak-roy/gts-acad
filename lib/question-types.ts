export const QUESTION_TYPE_VALUES = [
  "MCQ",
  "TRUE_FALSE",
  "NUMERIC",
  "ESSAY",
  "FILL_IN_THE_BLANK",
  "MULTI_INPUT_REASONING",
  "TWO_PART_ANALYSIS",
] as const;

export type QuestionTypeValue = (typeof QUESTION_TYPE_VALUES)[number];

export const QUESTION_TYPE_OPTIONS: ReadonlyArray<{
  value: QuestionTypeValue;
  label: string;
  shortLabel: string;
}> = [
  { value: "MCQ", label: "Multiple Choice", shortLabel: "MCQ" },
  { value: "TRUE_FALSE", label: "True / False", shortLabel: "True / False" },
  { value: "NUMERIC", label: "Numeric", shortLabel: "Numeric" },
  { value: "ESSAY", label: "Essay", shortLabel: "Essay" },
  { value: "FILL_IN_THE_BLANK", label: "Fill in the Blank", shortLabel: "Fill Blank" },
  { value: "MULTI_INPUT_REASONING", label: "Multi-Input Reasoning", shortLabel: "Multi-Input" },
  { value: "TWO_PART_ANALYSIS", label: "Two-Part Analysis", shortLabel: "Two-Part" },
];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  MCQ: "Multiple Choice",
  TRUE_FALSE: "True / False",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
};

export const QUESTION_TYPE_SHORT_LABELS: Record<QuestionTypeValue, string> = {
  MCQ: "MCQ",
  TRUE_FALSE: "True / False",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill Blank",
  MULTI_INPUT_REASONING: "Multi-Input",
  TWO_PART_ANALYSIS: "Two-Part",
};