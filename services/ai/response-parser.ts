import "server-only";

import type { AiGeneratedQuestion } from "@/services/ai/types";

type ToolCallArguments = Record<string, unknown>;

/**
 * Parse a single tool call result into a normalized AiGeneratedQuestion.
 * Maps each tool name's specific argument format into the common question payload.
 */
export function parseToolCallToQuestion(toolName: string, args: ToolCallArguments): AiGeneratedQuestion | null {
  try {
    switch (toolName) {
      case "create_mcq_question":
        return parseMcqToolCall(args);
      case "create_numeric_question":
        return parseNumericToolCall(args);
      case "create_fill_in_blank_question":
        return parseFillInBlankToolCall(args);
      case "create_essay_question":
        return parseEssayToolCall(args);
      case "create_two_part_analysis_question":
        return parseTwoPartToolCall(args);
      case "create_multi_input_reasoning_question":
        return parseMultiInputToolCall(args);
      default:
        console.warn(`Unknown AI tool call: ${toolName}`);
        return null;
    }
  } catch (error) {
    console.warn(`Failed to parse AI tool call "${toolName}":`, error);
    return null;
  }
}

function parseMcqToolCall(args: ToolCallArguments): AiGeneratedQuestion {
  const options = Array.isArray(args.options)
    ? args.options.map((opt: unknown, index: number) => {
        if (typeof opt === "object" && opt !== null) {
          const record = opt as Record<string, unknown>;
          return {
            label: typeof record.label === "string" ? record.label : String.fromCharCode(65 + index),
            text: typeof record.text === "string" ? record.text : "",
          };
        }
        return { label: String.fromCharCode(65 + index), text: String(opt ?? "") };
      })
    : [];

  return {
    questionText: String(args.questionText ?? ""),
    questionType: "MCQ",
    options,
    correctAnswer: String(args.correctAnswer ?? ""),
    explanation: String(args.explanation ?? ""),
    marks: safeMarks(args.marks),
  };
}

function parseNumericToolCall(args: ToolCallArguments): AiGeneratedQuestion {
  return {
    questionText: String(args.questionText ?? ""),
    questionType: "NUMERIC",
    options: null,
    correctAnswer: {
      value: Number(args.correctValue) || 0,
      tolerance: Number(args.tolerance) || 0,
    },
    explanation: String(args.explanation ?? ""),
    marks: safeMarks(args.marks),
  };
}

function parseFillInBlankToolCall(args: ToolCallArguments): AiGeneratedQuestion {
  const answers = Array.isArray(args.acceptedAnswers)
    ? args.acceptedAnswers.filter((a: unknown): a is string => typeof a === "string")
    : [];

  return {
    questionText: String(args.questionText ?? ""),
    questionType: "FILL_IN_THE_BLANK",
    options: null,
    correctAnswer: answers,
    explanation: String(args.explanation ?? ""),
    marks: safeMarks(args.marks),
  };
}

function parseEssayToolCall(args: ToolCallArguments): AiGeneratedQuestion {
  return {
    questionText: String(args.questionText ?? ""),
    questionType: "ESSAY",
    options: {
      rubric: String(args.rubric ?? ""),
      maxWordCount: Number(args.maxWordCount) || 500,
    },
    correctAnswer: null,
    explanation: "",
    marks: safeMarks(args.marks),
  };
}

function parseTwoPartToolCall(args: ToolCallArguments): AiGeneratedQuestion {
  const options = Array.isArray(args.options)
    ? args.options.filter((o: unknown): o is string => typeof o === "string")
    : [];

  return {
    questionText: String(args.questionText ?? ""),
    questionType: "TWO_PART_ANALYSIS",
    options,
    correctAnswer: {
      partA: String(args.correctPartA ?? ""),
      partB: String(args.correctPartB ?? ""),
    },
    explanation: String(args.explanation ?? ""),
    marks: safeMarks(args.marks),
  };
}

function parseMultiInputToolCall(args: ToolCallArguments): AiGeneratedQuestion {
  const inputFields = Array.isArray(args.inputFields)
    ? args.inputFields
        .filter((f: unknown): f is Record<string, unknown> => typeof f === "object" && f !== null)
        .map((f) => ({
          label: String(f.label ?? ""),
          expectedAnswer: String(f.expectedAnswer ?? ""),
        }))
    : [];

  const correctAnswer: Record<string, string> = {};
  for (const field of inputFields) {
    if (field.label) {
      correctAnswer[field.label] = field.expectedAnswer;
    }
  }

  return {
    questionText: String(args.questionText ?? ""),
    questionType: "MULTI_INPUT_REASONING",
    options: { fields: inputFields },
    correctAnswer,
    explanation: String(args.explanation ?? ""),
    marks: safeMarks(args.marks),
  };
}

function safeMarks(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : 1;
}
