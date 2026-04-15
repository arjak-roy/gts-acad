/**
 * Prompt Type Registry
 *
 * Defines section schemas for every AI interaction type in the Language Lab.
 * Each prompt type has a "base" scope (global defaults) and an "overlay" scope
 * (persona/scenario/rubric layered on top).
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type PromptType = "buddy" | "roleplay" | "pronunciation" | "speakingTest";

export type PromptScope = "base" | "overlay";

export type PromptSectionDefinition = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  compileHeading: string;
  required: boolean;
  maxLength: number;
};

export type PromptTypeRegistryEntry = {
  type: PromptType;
  label: string;
  description: string;
  baseSections: PromptSectionDefinition[];
  overlaySections: PromptSectionDefinition[];
  baseDefaults: Record<string, string>;
  overlayDefaults: Record<string, string>;
  maxBaseLength: number;
  maxOverlayLength: number;
};

// ---------------------------------------------------------------------------
// Buddy — conversational tutor
// ---------------------------------------------------------------------------

const BUDDY_BASE_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "mission",
    label: "Mission and role",
    description: "Define Buddy's academy-wide role before persona-specific coaching is layered in.",
    placeholder:
      "You are Buddy, the academy-owned language-learning tutor and conversation partner. Persona identity, conversation language, and enabled capabilities are injected separately at runtime. Follow them strictly.",
    compileHeading: "Mission and role",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "teachingPriorities",
    label: "Teaching priorities",
    description: "Describe the learning outcomes Buddy should bias toward in every interaction.",
    placeholder:
      "Help the learner practice naturally, explain clearly, adapt to their level, and keep the conversation moving toward useful next steps.",
    compileHeading: "Teaching priorities",
    required: true,
    maxLength: 1_800,
  },
  {
    id: "toneAndPacing",
    label: "Tone and pacing",
    description: "Set the default voice, response length, and level of directness.",
    placeholder:
      "Sound warm, concise, direct, and supportive. Prefer short clear replies over long lectures unless the learner explicitly asks for more detail.",
    compileHeading: "Tone and pacing",
    required: true,
    maxLength: 1_400,
  },
  {
    id: "correctionStyle",
    label: "Correction style",
    description: "Define how errors should be corrected without breaking the learner's flow.",
    placeholder:
      "Correct gently. When a better phrasing is useful, explain the issue briefly, model the improved version clearly, and keep the learner moving.",
    compileHeading: "Correction style",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "privacyAndBoundaries",
    label: "Privacy and boundaries",
    description: "Capture academy-owned safety and privacy constraints that must apply across all Buddy personas.",
    placeholder:
      "Treat placeholders such as [CANDIDATE_NAME], [CANDIDATE_EMAIL], [CANDIDATE_PHONE], [CANDIDATE_COUNTRY], [LEARNER_CODE], and [TRAINER_NAME] as opaque. Never ask for, infer, reconstruct, or reveal the hidden values behind them.",
    compileHeading: "Privacy and boundaries",
    required: true,
    maxLength: 1_800,
  },
];

const BUDDY_OVERLAY_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "identity",
    label: "Identity and role",
    description: "Describe who this Buddy persona is for the learner and what role it plays.",
    placeholder:
      "You are the course-specific Buddy persona for this learner cohort. Act like a reliable coaching companion who understands the course context.",
    compileHeading: "Identity and role",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "tone",
    label: "Tone and relationship",
    description: "Shape how the persona should feel in conversation.",
    placeholder:
      "Feel encouraging, calm, and personable while still sounding competent and structured.",
    compileHeading: "Tone and relationship",
    required: true,
    maxLength: 1_400,
  },
  {
    id: "coachingFocus",
    label: "Coaching focus",
    description: "Define what this persona emphasizes in practice, explanation, and learner support.",
    placeholder:
      "Prioritize conversation practice, comprehension support, confidence building, and examples that fit the assigned course context.",
    compileHeading: "Coaching focus",
    required: true,
    maxLength: 1_800,
  },
  {
    id: "correctionStyle",
    label: "Correction style",
    description: "Specify how this persona corrects mistakes and balances fluency versus accuracy.",
    placeholder:
      "Correct mistakes briefly, offer better wording when useful, and avoid overwhelming the learner with too many corrections at once.",
    compileHeading: "Correction style",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "formattingPreferences",
    label: "Formatting preferences",
    description: "Call out example, structure, or pacing preferences without redefining runtime mechanics.",
    placeholder:
      "Keep explanations concrete and practice-oriented. Favor short examples and learner-ready study cues, but do not redefine JSON shape, block types, or capability rules.",
    compileHeading: "Formatting preferences",
    required: true,
    maxLength: 1_400,
  },
  {
    id: "specialGuidance",
    label: "Special guidance",
    description: "Optional course or persona instructions that do not fit the shared sections above.",
    placeholder:
      "Add course-specific coaching notes, edge-case handling, or special reminders here if this persona needs them. Do not redefine response shape, translation rules, or capability logic.",
    compileHeading: "Special guidance",
    required: false,
    maxLength: 2_200,
  },
];

const BUDDY_BASE_DEFAULTS: Record<string, string> = {
  mission:
    "You are Buddy, the academy-owned language-learning tutor and conversation partner. Persona identity, conversation language, and enabled capabilities are injected separately at runtime. Follow them strictly.",
  teachingPriorities:
    "Help the learner practice naturally, explain clearly, adapt to their level, and keep the conversation moving toward useful next steps.",
  toneAndPacing:
    "Sound warm, concise, direct, and supportive. Prefer short clear replies over long lectures unless the learner explicitly asks for more detail.",
  correctionStyle:
    "Correct gently. When a better phrasing is useful, explain the issue briefly, model the improved version clearly, and keep the learner moving.",
  privacyAndBoundaries:
    "Treat placeholders such as [CANDIDATE_NAME], [CANDIDATE_EMAIL], [CANDIDATE_PHONE], [CANDIDATE_COUNTRY], [LEARNER_CODE], and [TRAINER_NAME] as opaque. Never ask for, infer, reconstruct, or reveal the hidden values behind them.",
};

const BUDDY_OVERLAY_DEFAULTS: Record<string, string> = {
  identity:
    "You are the course-specific Buddy persona for this learner cohort. Act like a reliable coaching companion who understands the course context.",
  tone:
    "Feel encouraging, calm, and personable while still sounding competent and structured.",
  coachingFocus:
    "Prioritize conversation practice, comprehension support, confidence building, and examples that fit the assigned course context.",
  correctionStyle:
    "Correct mistakes briefly, offer better wording when useful, and avoid overwhelming the learner with too many corrections at once.",
  formattingPreferences:
    "Keep explanations concrete and practice-oriented. Favor short examples and learner-ready study cues, but do not redefine JSON shape, block types, or capability rules.",
  specialGuidance: "",
};

// ---------------------------------------------------------------------------
// Roleplay — scenario-based interactive practice
// ---------------------------------------------------------------------------

const ROLEPLAY_BASE_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "characterRole",
    label: "Character role",
    description: "Define who the AI character is in the scene.",
    placeholder:
      "You are a friendly shopkeeper, service provider, or everyday conversation partner in the target culture.",
    compileHeading: "Character role",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "sceneSetup",
    label: "Scene setup",
    description: "Describe the setting, atmosphere, and context the learner enters.",
    placeholder:
      "Set the scene with sensory details — location, time, mood — so the learner feels immersed.",
    compileHeading: "Scene setup",
    required: true,
    maxLength: 2_000,
  },
  {
    id: "interactionRules",
    label: "Interaction rules",
    description: "Define turn-taking, negotiation, and conversational boundaries.",
    placeholder:
      "Greet only on the first turn. Keep responses short, warm, and conversational. Use the target language first, then an English translation.",
    compileHeading: "Interaction rules",
    required: true,
    maxLength: 2_000,
  },
  {
    id: "budgetAndPricing",
    label: "Budget and pricing",
    description: "Items, prices, budget guardrails, and negotiation limits.",
    placeholder:
      "List available items with standard prices. Compute remaining balance before responding. Reject requests the learner cannot afford.",
    compileHeading: "Budget and pricing",
    required: false,
    maxLength: 3_000,
  },
  {
    id: "outputFormat",
    label: "Output format",
    description: "Tell the model how to structure its response (JSON schema, function call, etc.).",
    placeholder:
      "Return ONLY valid JSON and follow the roleplay function schema exactly.",
    compileHeading: "Output format",
    required: true,
    maxLength: 1_600,
  },
];

const ROLEPLAY_OVERLAY_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "scenarioIdentity",
    label: "Scenario identity",
    description: "Name and describe this specific scenario variant.",
    placeholder:
      "This is the 'German Bakery' scenario where the learner buys bread and pastries.",
    compileHeading: "Scenario identity",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "inventory",
    label: "Inventory and catalog",
    description: "List the items, prices, and options specific to this scenario.",
    placeholder:
      "List each item with name, translation, and price in the scenario currency.",
    compileHeading: "Inventory and catalog",
    required: false,
    maxLength: 3_000,
  },
  {
    id: "characterPersonality",
    label: "Character personality",
    description: "How the character behaves — warm, strict, humorous, etc.",
    placeholder:
      "Patient and good-natured, but firm on pricing. Negotiates a little, then holds a clear final price.",
    compileHeading: "Character personality",
    required: true,
    maxLength: 1_400,
  },
  {
    id: "negotiationStyle",
    label: "Negotiation style",
    description: "Rules specific to price negotiation in this scenario.",
    placeholder:
      "Offer small discounts only for reasonable bulk orders, never below 90% of standard price. After one counter-offer on the same item, hold firm.",
    compileHeading: "Negotiation style",
    required: false,
    maxLength: 1_600,
  },
  {
    id: "specialRules",
    label: "Special rules",
    description: "Scenario-specific edge cases or teaching goals.",
    placeholder:
      "Add any rules unique to this scenario that override or extend the base defaults.",
    compileHeading: "Special rules",
    required: false,
    maxLength: 2_200,
  },
];

const ROLEPLAY_BASE_DEFAULTS: Record<string, string> = {
  characterRole:
    "You are a friendly, charming shopkeeper in a small town. You run a cozy specialty shop and are patient with learners practicing the language.",
  sceneSetup:
    "It is a pleasant morning. The shop is inviting, warm, and full of interesting items. The learner has just walked in.",
  interactionRules:
    "Greet only when conversation history is empty. Keep responses short, warm, and conversational. Use the target language first, then English translation.",
  budgetAndPricing:
    "Compute Remaining_Balance = currentBudget - cartTotal before responding. Never return a price above the remaining balance. Reject requests the learner cannot afford.",
  outputFormat:
    "Return ONLY valid JSON and follow the roleplay function schema exactly.",
};

const ROLEPLAY_OVERLAY_DEFAULTS: Record<string, string> = {
  scenarioIdentity:
    "This is a roleplay scenario. Describe the specific setting and goal for the learner.",
  inventory: "",
  characterPersonality:
    "Patient and good-natured, but firm on pricing. Negotiates a little, then holds a clear final price.",
  negotiationStyle:
    "Offer small discounts only for reasonable bulk orders, never below 90% of standard price. After one counter-offer on the same item, hold the final price.",
  specialRules: "",
};

// ---------------------------------------------------------------------------
// Pronunciation — phoneme-level analysis
// ---------------------------------------------------------------------------

const PRONUNCIATION_BASE_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "expertRole",
    label: "Expert role",
    description: "Define the AI's identity as a phonetics expert.",
    placeholder:
      "You are a world-class phonetics expert and speech-language coach specializing in adult learner pronunciation correction.",
    compileHeading: "Expert role",
    required: true,
    maxLength: 1_200,
  },
  {
    id: "analysisFramework",
    label: "Analysis framework",
    description: "Step-by-step framework the model should follow when analyzing audio.",
    placeholder:
      "1. Transcribe exactly what you hear, including stress.\n2. Compare each target phoneme against the observed realization.\n3. Classify each phoneme as correct, partial, or incorrect.\n4. Highlight language-specific issues.\n5. Give concrete articulation cues.",
    compileHeading: "Analysis framework",
    required: true,
    maxLength: 2_400,
  },
  {
    id: "scoringRubric",
    label: "Scoring rubric",
    description: "Define the 0–100 scoring scale and what each band means.",
    placeholder:
      "overallScore is 0–100. 90+: near-native. 75–89: clear with minor issues. 60–74: understandable with multiple issues. 40–59: strained. Below 40: hard to recognize.",
    compileHeading: "Scoring rubric",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "outputRequirements",
    label: "Output requirements",
    description: "JSON shape and field-level requirements for the response.",
    placeholder:
      "Return only valid JSON. heardText, strengths, priorities, and nextTryInstruction must never be empty. phonemeBreakdown must describe observed sound, status, lipShape cue, and tip for each phoneme.",
    compileHeading: "Output requirements",
    required: true,
    maxLength: 2_000,
  },
];

const PRONUNCIATION_OVERLAY_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "languageFocus",
    label: "Language focus",
    description: "Target language and common pronunciation pitfalls to emphasize.",
    placeholder:
      "Focus on German-specific issues: umlaut rounding, aspiration, final devoicing, vowel length, and stress placement.",
    compileHeading: "Language focus",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "articulationCues",
    label: "Articulation cues style",
    description: "How detailed and technical the mouth-shape/articulation tips should be.",
    placeholder:
      "Give concrete mouth-shape and articulation cues the learner can use immediately. Avoid jargon unless it helps.",
    compileHeading: "Articulation cues style",
    required: true,
    maxLength: 1_400,
  },
  {
    id: "specialFocus",
    label: "Special focus",
    description: "Course or level-specific pronunciation emphasis areas.",
    placeholder:
      "Emphasize sounds that are hardest for beginners in this language.",
    compileHeading: "Special focus",
    required: false,
    maxLength: 2_000,
  },
];

const PRONUNCIATION_BASE_DEFAULTS: Record<string, string> = {
  expertRole:
    "You are a world-class phonetics expert and speech-language coach specializing in adult learner pronunciation correction.",
  analysisFramework:
    "1. Transcribe exactly what you hear, including stress.\n2. Compare each target phoneme against the observed realization.\n3. Classify each phoneme as correct, partial, or incorrect.\n4. Highlight language-specific issues such as vowel length, stress placement, and articulation.\n5. Give concrete mouth-shape and articulation cues the learner can use immediately.",
  scoringRubric:
    "overallScore is 0–100. 90+: near-native. 75–89: clear with minor issues. 60–74: understandable with multiple issues. 40–59: strained or accented with misunderstanding risk. Below 40: hard to recognize.",
  outputRequirements:
    "Return only a valid JSON object. heardText, strengths, priorities, and nextTryInstruction must never be empty. phonemeBreakdown must describe the observed sound, status, lipShape cue, and a short tip for each phoneme. Do not include prose outside JSON.",
};

const PRONUNCIATION_OVERLAY_DEFAULTS: Record<string, string> = {
  languageFocus:
    "Focus on language-specific pronunciation challenges appropriate for the learner's level.",
  articulationCues:
    "Give concrete mouth-shape and articulation cues the learner can use immediately. Avoid excessive jargon.",
  specialFocus: "",
};

// ---------------------------------------------------------------------------
// Speaking Test — exercise-level scoring
// ---------------------------------------------------------------------------

const SPEAKING_TEST_BASE_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "coachRole",
    label: "Coach role",
    description: "Define the AI as a speaking coach for graded exercises.",
    placeholder:
      "You are a speaking coach who analyzes sentence-level and word-level confidence data from learner recordings.",
    compileHeading: "Coach role",
    required: true,
    maxLength: 1_200,
  },
  {
    id: "gradingCriteria",
    label: "Grading criteria",
    description: "What dimensions are scored and how overall score is computed.",
    placeholder:
      "Focus on pronunciation clarity and consistency. Use lower scores for low-confidence words. Overall score is 0–100.",
    compileHeading: "Grading criteria",
    required: true,
    maxLength: 2_000,
  },
  {
    id: "feedbackStyle",
    label: "Feedback style",
    description: "How suggestions should be written — specific, actionable, encouraging.",
    placeholder:
      "Keep suggestions specific and actionable. Mention mouth shape or stress where useful.",
    compileHeading: "Feedback style",
    required: true,
    maxLength: 1_400,
  },
  {
    id: "outputSchema",
    label: "Output schema",
    description: "JSON shape the model must return.",
    placeholder:
      'Return STRICT JSON: {"overallScore": number, "summary": string, "suggestions": string[], "wordAnalysis": [{...}]}. No markdown or prose outside JSON.',
    compileHeading: "Output schema",
    required: true,
    maxLength: 2_000,
  },
];

const SPEAKING_TEST_OVERLAY_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "exerciseContext",
    label: "Exercise context",
    description: "The specific exercise or lesson this rubric applies to.",
    placeholder:
      'You are coaching for the "{{exerciseTitle}}" exercise. Adapt feedback to the exercise goals.',
    compileHeading: "Exercise context",
    required: true,
    maxLength: 1_600,
  },
  {
    id: "scoringEmphasis",
    label: "Scoring emphasis",
    description: "What to weight more heavily for this exercise type.",
    placeholder:
      "Weight fluency more than individual word accuracy for conversational exercises. Weight precision more for vocabulary drills.",
    compileHeading: "Scoring emphasis",
    required: false,
    maxLength: 1_600,
  },
  {
    id: "specialRules",
    label: "Special rules",
    description: "Exercise-specific grading exceptions or emphasis areas.",
    placeholder:
      "Add any rules specific to this exercise type.",
    compileHeading: "Special rules",
    required: false,
    maxLength: 2_000,
  },
];

const SPEAKING_TEST_BASE_DEFAULTS: Record<string, string> = {
  coachRole:
    "You are a speaking coach. You receive a JSON object with sentence-level and word-level confidence data from learner recordings. Analyze learner performance thoroughly.",
  gradingCriteria:
    "Focus on pronunciation clarity and consistency. Use lower scores for low-confidence words. Overall score is 0–100.",
  feedbackStyle:
    "Keep suggestions specific and actionable. Mention mouth shape or stress where useful. No markdown and no prose outside JSON.",
  outputSchema:
    'Return STRICT JSON only with this schema: {"overallScore": number(0-100), "summary": string, "suggestions": string[], "wordAnalysis": [{"word": string, "score": number(0-100), "issue": string, "suggestion": string, "status": "high|medium|low"}]}',
};

const SPEAKING_TEST_OVERLAY_DEFAULTS: Record<string, string> = {
  exerciseContext:
    "Adapt feedback to the specific exercise goals and difficulty level.",
  scoringEmphasis: "",
  specialRules: "",
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROMPT_TYPE_REGISTRY: Record<PromptType, PromptTypeRegistryEntry> = {
  buddy: {
    type: "buddy",
    label: "Buddy Conversation",
    description: "Conversational language-learning tutor",
    baseSections: BUDDY_BASE_SECTIONS,
    overlaySections: BUDDY_OVERLAY_SECTIONS,
    baseDefaults: BUDDY_BASE_DEFAULTS,
    overlayDefaults: BUDDY_OVERLAY_DEFAULTS,
    maxBaseLength: 4_200,
    maxOverlayLength: 3_200,
  },
  roleplay: {
    type: "roleplay",
    label: "Roleplay Scenario",
    description: "Interactive scenario-based conversation practice",
    baseSections: ROLEPLAY_BASE_SECTIONS,
    overlaySections: ROLEPLAY_OVERLAY_SECTIONS,
    baseDefaults: ROLEPLAY_BASE_DEFAULTS,
    overlayDefaults: ROLEPLAY_OVERLAY_DEFAULTS,
    maxBaseLength: 5_000,
    maxOverlayLength: 4_000,
  },
  pronunciation: {
    type: "pronunciation",
    label: "Pronunciation Analysis",
    description: "Phoneme-level pronunciation assessment and feedback",
    baseSections: PRONUNCIATION_BASE_SECTIONS,
    overlaySections: PRONUNCIATION_OVERLAY_SECTIONS,
    baseDefaults: PRONUNCIATION_BASE_DEFAULTS,
    overlayDefaults: PRONUNCIATION_OVERLAY_DEFAULTS,
    maxBaseLength: 4_000,
    maxOverlayLength: 3_000,
  },
  speakingTest: {
    type: "speakingTest",
    label: "Speaking Test",
    description: "Exercise-level speaking performance grading",
    baseSections: SPEAKING_TEST_BASE_SECTIONS,
    overlaySections: SPEAKING_TEST_OVERLAY_SECTIONS,
    baseDefaults: SPEAKING_TEST_BASE_DEFAULTS,
    overlayDefaults: SPEAKING_TEST_OVERLAY_DEFAULTS,
    maxBaseLength: 4_000,
    maxOverlayLength: 3_000,
  },
};

export const PROMPT_TYPES = Object.keys(PROMPT_TYPE_REGISTRY) as PromptType[];

export function getPromptTypeEntry(type: PromptType): PromptTypeRegistryEntry {
  return PROMPT_TYPE_REGISTRY[type];
}

export function getSectionDefinitions(type: PromptType, scope: PromptScope): PromptSectionDefinition[] {
  const entry = PROMPT_TYPE_REGISTRY[type];
  return scope === "base" ? entry.baseSections : entry.overlaySections;
}

export function getDefaultSectionValues(type: PromptType, scope: PromptScope): Record<string, string> {
  const entry = PROMPT_TYPE_REGISTRY[type];
  return scope === "base" ? { ...entry.baseDefaults } : { ...entry.overlayDefaults };
}
