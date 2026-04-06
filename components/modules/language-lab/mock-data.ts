export type LanguageLabTone = "info" | "accent" | "success" | "warning" | "danger";

export type LanguageLabWeeklyRoleplayPoint = {
  label: string;
  sessions: number;
  avgScore: number;
};

export type LanguageLabCategoryScore = {
  label: string;
  score: number;
  delta: number;
  tone: LanguageLabTone;
};

export type LanguageLabReadinessLevel = {
  label: string;
  learners: number;
  target: string;
};

export type LanguageLabBlocker = {
  label: string;
  share: number;
  note: string;
};

export type LanguageLabWordScore = {
  word: string;
  context: string;
  tries: number;
  bestScore: number;
  averageScore: number;
  consistency: number;
  stressAccuracy: number;
  vowelLength: number;
  trend: number[];
  aiTag: string;
};

export type LanguageLabHotspot = {
  label: string;
  score: number;
  issue: string;
};

export type LanguageLabScoreBand = {
  label: string;
  learners: number;
};

export type LanguageLabRoleplayScenario = {
  title: string;
  theme: string;
  tries: number;
  bestScore: number;
  latestScore: number;
  fluency: number;
  vocabulary: number;
  politeness: number;
  completion: number;
  scoreTrend: number[];
  note: string;
};

export type LanguageLabRecentAttempt = {
  learner: string;
  scenario: string;
  attemptAt: string;
  aiScore: number;
  fluency: number;
  status: string;
};

export type LanguageLabListeningDrill = {
  title: string;
  difficulty: string;
  accuracy: number;
  attempts: number;
  note: string;
};

export type LanguageLabPhrase = {
  phrase: string;
  category: string;
  mastery: number;
  timesUsed: number;
  note: string;
};

export type LanguageLabConfidencePoint = {
  label: string;
  x: number;
  y: number;
  size: number;
  tone: LanguageLabTone;
};

export type LanguageLabFeedbackTheme = {
  theme: string;
  count: number;
  detail: string;
};

export type LanguageLabPracticeRitual = {
  title: string;
  detail: string;
};

export type LanguageLabBatch = {
  id: string;
  code: string;
  name: string;
  track: string;
  coach: string;
  snapshotLabel: string;
  summary: string;
  overview: {
    sessionsThisWeek: number;
    avgPronunciation: number;
    avgRoleplay: number;
    listeningAccuracy: number;
    phraseMastery: number;
    flaggedLearners: number;
    totalLearners: number;
    streakSessions: number;
    activeRoleplays: number;
  };
  weeklyRoleplay: LanguageLabWeeklyRoleplayPoint[];
  pronunciationCategories: LanguageLabCategoryScore[];
  cefrReadiness: LanguageLabReadinessLevel[];
  blockers: LanguageLabBlocker[];
  spotlight: {
    learner: string;
    focus: string;
    improvement: string;
    lastSession: string;
    note: string;
  };
  pronunciationWords: LanguageLabWordScore[];
  phonemeHotspots: LanguageLabHotspot[];
  pronunciationScoreBands: LanguageLabScoreBand[];
  roleplays: LanguageLabRoleplayScenario[];
  recentAttempts: LanguageLabRecentAttempt[];
  vocabularySnapshot: {
    fillerWordRate: number;
    fillerWordDelta: number;
    phrasesMasteredThisWeek: number;
    dictationCompletion: number;
    aiConfidence: number;
  };
  listeningDrills: LanguageLabListeningDrill[];
  phraseBank: LanguageLabPhrase[];
  confidenceMatrix: LanguageLabConfidencePoint[];
  feedbackThemes: LanguageLabFeedbackTheme[];
  practiceRituals: LanguageLabPracticeRitual[];
};

export const LANGUAGE_LAB_BATCHES: LanguageLabBatch[] = [
  {
    id: "retail-fluency-batch",
    code: "GTS-LL-BAK-07",
    name: "German Bakery and Counter Service",
    track: "Retail German Fluency",
    coach: "Mira Schneider",
    snapshotLabel: "8-week client preview",
    summary:
      "Counter confidence is high and the batch handles warm greetings well. Precision drops when learners explain allergens, prices, and fast-moving custom orders.",
    overview: {
      sessionsThisWeek: 28,
      avgPronunciation: 86,
      avgRoleplay: 84,
      listeningAccuracy: 81,
      phraseMastery: 76,
      flaggedLearners: 3,
      totalLearners: 24,
      streakSessions: 42,
      activeRoleplays: 6,
    },
    weeklyRoleplay: [
      { label: "Wk 1", sessions: 14, avgScore: 71 },
      { label: "Wk 2", sessions: 18, avgScore: 75 },
      { label: "Wk 3", sessions: 22, avgScore: 79 },
      { label: "Wk 4", sessions: 21, avgScore: 81 },
      { label: "Wk 5", sessions: 25, avgScore: 83 },
      { label: "Wk 6", sessions: 28, avgScore: 84 },
    ],
    pronunciationCategories: [
      { label: "Stress placement", score: 88, delta: 5, tone: "info" },
      { label: "Vowel length", score: 78, delta: 4, tone: "warning" },
      { label: "Consonant endings", score: 84, delta: 7, tone: "success" },
      { label: "Sentence rhythm", score: 82, delta: 6, tone: "accent" },
    ],
    cefrReadiness: [
      { label: "A2 Stable", learners: 5, target: "Service phrases with prompting" },
      { label: "A2+ Moving", learners: 8, target: "Longer customer explanations" },
      { label: "B1 Ready", learners: 9, target: "Shift-ready for roleplay only" },
      { label: "B1 Strong", learners: 2, target: "Can mentor pair practice" },
    ],
    blockers: [
      { label: "Allergen explanation", share: 72, note: "Confidence dips when dairy and nut substitutions are discussed." },
      { label: "Fast price dictation", share: 63, note: "Numbers land clearly at slow speed but blur in rush-hour pacing." },
      { label: "Custom cake requests", share: 56, note: "Learners pause while collecting special-order details." },
    ],
    spotlight: {
      learner: "Anika G.",
      focus: "Customer clarification and upsell prompts",
      improvement: "+11 points across bakery roleplays in 10 days",
      lastSession: "Yesterday, 18:40",
      note: "AI flagged stronger sentence endings and better hesitation recovery after shadowing drills.",
    },
    pronunciationWords: [
      {
        word: "Baeckerei",
        context: "Morning bakery greeting",
        tries: 16,
        bestScore: 93,
        averageScore: 87,
        consistency: 84,
        stressAccuracy: 90,
        vowelLength: 80,
        trend: [72, 79, 84, 88, 93],
        aiTag: "Strong recovery on ae vowel stretch",
      },
      {
        word: "Wechselgeld",
        context: "Cash counter workflow",
        tries: 13,
        bestScore: 89,
        averageScore: 82,
        consistency: 77,
        stressAccuracy: 85,
        vowelLength: 72,
        trend: [68, 73, 78, 84, 89],
        aiTag: "Ending consonants still soften under speed",
      },
      {
        word: "Roggenbrot",
        context: "Bread recommendation script",
        tries: 12,
        bestScore: 86,
        averageScore: 80,
        consistency: 75,
        stressAccuracy: 79,
        vowelLength: 77,
        trend: [64, 70, 76, 81, 86],
        aiTag: "Improved g-b cluster separation",
      },
      {
        word: "Angebot",
        context: "Daily offer highlight",
        tries: 11,
        bestScore: 91,
        averageScore: 85,
        consistency: 83,
        stressAccuracy: 87,
        vowelLength: 82,
        trend: [71, 78, 82, 88, 91],
        aiTag: "Good sentence lift, final t needs crisper release",
      },
      {
        word: "Quittung",
        context: "Receipt confirmation",
        tries: 9,
        bestScore: 84,
        averageScore: 78,
        consistency: 74,
        stressAccuracy: 76,
        vowelLength: 73,
        trend: [60, 68, 73, 79, 84],
        aiTag: "Initial q sound cleaner, middle syllable still clipped",
      },
      {
        word: "Fruehstueck",
        context: "Breakfast order handling",
        tries: 15,
        bestScore: 88,
        averageScore: 83,
        consistency: 79,
        stressAccuracy: 86,
        vowelLength: 75,
        trend: [66, 72, 79, 84, 88],
        aiTag: "Front-loaded stress now consistent across attempts",
      },
    ],
    phonemeHotspots: [
      { label: "ae / oe / ue vowels", score: 61, issue: "Long vowels collapse during fast greetings." },
      { label: "final -ng release", score: 67, issue: "Word endings flatten in receipt and closing lines." },
      { label: "ch friction", score: 72, issue: "Softer than target when repeating customer names." },
      { label: "compound stress", score: 78, issue: "Second nouns still steal emphasis in menu items." },
    ],
    pronunciationScoreBands: [
      { label: "90+", learners: 4 },
      { label: "80-89", learners: 11 },
      { label: "70-79", learners: 6 },
      { label: "Below 70", learners: 3 },
    ],
    roleplays: [
      {
        title: "A morning at a German bakery",
        theme: "Warm greeting + order capture",
        tries: 21,
        bestScore: 92,
        latestScore: 88,
        fluency: 86,
        vocabulary: 91,
        politeness: 94,
        completion: 97,
        scoreTrend: [68, 75, 81, 86, 92],
        note: "Excellent flow at the opening. AI still flags speed on price confirmation and change handoff.",
      },
      {
        title: "Handling a custom cake order",
        theme: "Clarification and note-taking",
        tries: 17,
        bestScore: 87,
        latestScore: 84,
        fluency: 81,
        vocabulary: 88,
        politeness: 90,
        completion: 89,
        scoreTrend: [62, 71, 76, 81, 87],
        note: "Improving on spelling names and dates, but pauses increase during allergy details.",
      },
      {
        title: "Explaining allergens at the counter",
        theme: "Safety language",
        tries: 14,
        bestScore: 83,
        latestScore: 80,
        fluency: 77,
        vocabulary: 84,
        politeness: 89,
        completion: 82,
        scoreTrend: [58, 66, 71, 77, 83],
        note: "The batch knows the words, but the sentence frames still sound memorized instead of natural.",
      },
      {
        title: "Resolving a card machine delay",
        theme: "Service recovery",
        tries: 12,
        bestScore: 85,
        latestScore: 82,
        fluency: 80,
        vocabulary: 83,
        politeness: 91,
        completion: 85,
        scoreTrend: [60, 69, 74, 79, 85],
        note: "Polite phrasing is strong; AI wants tighter repair language under pressure.",
      },
    ],
    recentAttempts: [
      { learner: "Priyanka S.", scenario: "A morning at a German bakery", attemptAt: "Today, 09:10", aiScore: 88, fluency: 86, status: "Coach review" },
      { learner: "Ritwik M.", scenario: "Explaining allergens at the counter", attemptAt: "Today, 08:45", aiScore: 81, fluency: 76, status: "Needs repetition" },
      { learner: "Anika G.", scenario: "Handling a custom cake order", attemptAt: "Yesterday, 19:05", aiScore: 84, fluency: 82, status: "Stable" },
      { learner: "Sara P.", scenario: "Resolving a card machine delay", attemptAt: "Yesterday, 18:20", aiScore: 82, fluency: 79, status: "Recovered" },
    ],
    vocabularySnapshot: {
      fillerWordRate: 6.2,
      fillerWordDelta: -1.4,
      phrasesMasteredThisWeek: 38,
      dictationCompletion: 87,
      aiConfidence: 83,
    },
    listeningDrills: [
      { title: "Rush-hour order dictation", difficulty: "Intermediate", accuracy: 82, attempts: 31, note: "Main errors cluster around prices and add-ons." },
      { title: "Bakery small-talk listening", difficulty: "Intermediate", accuracy: 85, attempts: 24, note: "Greeting responses are consistent across the batch." },
      { title: "Allergen alert playback", difficulty: "Advanced", accuracy: 76, attempts: 19, note: "Longer noun chains still require replay." },
    ],
    phraseBank: [
      { phrase: "Moechten Sie noch etwas dazu?", category: "Upsell", mastery: 88, timesUsed: 54, note: "Often delivered naturally after bread suggestions." },
      { phrase: "Das Angebot gilt nur heute.", category: "Promotions", mastery: 79, timesUsed: 33, note: "Needs cleaner final consonant release." },
      { phrase: "Enthaelt das Produkt Nuesse?", category: "Allergens", mastery: 74, timesUsed: 21, note: "Confidence dips when the reply gets longer." },
      { phrase: "Ich bringe Ihnen sofort die Quittung.", category: "Service recovery", mastery: 81, timesUsed: 17, note: "Strong politeness markers, timing still stiff." },
      { phrase: "Die Kartenzahlung dauert einen Moment.", category: "Delay handling", mastery: 77, timesUsed: 14, note: "Better when paced in two chunks." },
    ],
    confidenceMatrix: [
      { label: "Bakery greeting", x: 84, y: 90, size: 16, tone: "info" },
      { label: "Cash handling", x: 71, y: 82, size: 15, tone: "accent" },
      { label: "Allergen explanation", x: 59, y: 74, size: 18, tone: "warning" },
      { label: "Complaint recovery", x: 67, y: 80, size: 14, tone: "success" },
    ],
    feedbackThemes: [
      { theme: "Number clarity", count: 18, detail: "Prices and quantities blend when learners accelerate." },
      { theme: "Sentence endings", count: 14, detail: "Final consonants fade after long greetings." },
      { theme: "Customer clarification", count: 11, detail: "Learners need stronger repair prompts for misunderstood orders." },
    ],
    practiceRituals: [
      { title: "Two-speed shadowing", detail: "Run bakery greetings once at normal pace and once at rush-hour pace." },
      { title: "Allergen ladder", detail: "Start with single ingredient warnings, then expand into full reassurance scripts." },
      { title: "Price echo drill", detail: "Mirror every euro amount back to build crisp number delivery." },
    ],
  },
  {
    id: "healthcare-german-batch",
    code: "GTS-LL-MED-11",
    name: "Healthcare German Interaction Lab",
    track: "Clinical Communication",
    coach: "Leonie Das",
    snapshotLabel: "6-week readiness view",
    summary:
      "The cohort performs well in patient intake and polite reassurance. Pronunciation drops on medical compounds and medication timing language.",
    overview: {
      sessionsThisWeek: 24,
      avgPronunciation: 82,
      avgRoleplay: 80,
      listeningAccuracy: 79,
      phraseMastery: 73,
      flaggedLearners: 4,
      totalLearners: 22,
      streakSessions: 35,
      activeRoleplays: 5,
    },
    weeklyRoleplay: [
      { label: "Wk 1", sessions: 12, avgScore: 68 },
      { label: "Wk 2", sessions: 15, avgScore: 72 },
      { label: "Wk 3", sessions: 18, avgScore: 76 },
      { label: "Wk 4", sessions: 20, avgScore: 78 },
      { label: "Wk 5", sessions: 22, avgScore: 80 },
      { label: "Wk 6", sessions: 24, avgScore: 80 },
    ],
    pronunciationCategories: [
      { label: "Medical compounds", score: 76, delta: 6, tone: "warning" },
      { label: "Patient reassurance", score: 84, delta: 5, tone: "success" },
      { label: "Phone etiquette", score: 81, delta: 7, tone: "info" },
      { label: "Question cadence", score: 79, delta: 4, tone: "accent" },
    ],
    cefrReadiness: [
      { label: "A2 Stable", learners: 4, target: "Structured patient prompts" },
      { label: "A2+ Moving", learners: 7, target: "Medication instructions with support" },
      { label: "B1 Ready", learners: 8, target: "Independent intake roleplays" },
      { label: "B1 Strong", learners: 3, target: "High-pressure call handling" },
    ],
    blockers: [
      { label: "Medication timing", share: 70, note: "Sentence order changes when learners mention frequency and dose." },
      { label: "Compound nouns", share: 61, note: "Words stretch correctly in isolation, not inside full instructions." },
      { label: "Follow-up questions", share: 49, note: "Learners still overuse fixed scripts instead of natural clarification." },
    ],
    spotlight: {
      learner: "Richa N.",
      focus: "Patient reassurance and intake sequencing",
      improvement: "+9 points in hospital desk scenarios over the last week",
      lastSession: "Today, 07:50",
      note: "AI flagged calmer pacing and clearer symptom follow-up questions during repeat takes.",
    },
    pronunciationWords: [
      {
        word: "Krankenhaus",
        context: "Hospital check-in",
        tries: 18,
        bestScore: 90,
        averageScore: 83,
        consistency: 80,
        stressAccuracy: 87,
        vowelLength: 74,
        trend: [66, 74, 78, 84, 90],
        aiTag: "Compound stress now lands on the first element",
      },
      {
        word: "Medikament",
        context: "Medication explanation",
        tries: 14,
        bestScore: 86,
        averageScore: 79,
        consistency: 73,
        stressAccuracy: 82,
        vowelLength: 71,
        trend: [61, 69, 74, 80, 86],
        aiTag: "Middle syllables still compress in longer sentences",
      },
      {
        word: "Aufnahme",
        context: "Patient admission",
        tries: 10,
        bestScore: 84,
        averageScore: 78,
        consistency: 72,
        stressAccuracy: 80,
        vowelLength: 73,
        trend: [60, 66, 72, 79, 84],
        aiTag: "Clean opening vowel, final syllable softens when rushed",
      },
      {
        word: "Temperatur",
        context: "Vitals collection",
        tries: 12,
        bestScore: 87,
        averageScore: 81,
        consistency: 77,
        stressAccuracy: 84,
        vowelLength: 75,
        trend: [64, 72, 77, 82, 87],
        aiTag: "Strong improvements after syllable chunking",
      },
      {
        word: "Termin",
        context: "Appointment booking",
        tries: 15,
        bestScore: 89,
        averageScore: 84,
        consistency: 81,
        stressAccuracy: 86,
        vowelLength: 79,
        trend: [69, 75, 80, 86, 89],
        aiTag: "Phone-tone pacing is noticeably more natural",
      },
      {
        word: "Schmerzskala",
        context: "Pain assessment",
        tries: 11,
        bestScore: 82,
        averageScore: 76,
        consistency: 71,
        stressAccuracy: 78,
        vowelLength: 69,
        trend: [57, 64, 71, 77, 82],
        aiTag: "Clustered consonants still need more deliberate separation",
      },
    ],
    phonemeHotspots: [
      { label: "sch / rz clusters", score: 59, issue: "Compound medical nouns still crowd together." },
      { label: "long a vowels", score: 68, issue: "Vowels shrink inside medication instructions." },
      { label: "intake question pitch", score: 74, issue: "Questions sometimes sound flat rather than inviting." },
      { label: "terminal stress", score: 77, issue: "Final emphasis improves when learners pause before key nouns." },
    ],
    pronunciationScoreBands: [
      { label: "90+", learners: 3 },
      { label: "80-89", learners: 9 },
      { label: "70-79", learners: 7 },
      { label: "Below 70", learners: 3 },
    ],
    roleplays: [
      {
        title: "Hospital check-in desk",
        theme: "Patient intake",
        tries: 19,
        bestScore: 90,
        latestScore: 86,
        fluency: 84,
        vocabulary: 88,
        politeness: 93,
        completion: 95,
        scoreTrend: [65, 73, 79, 85, 90],
        note: "The flow is stronger, but name spelling and symptom confirmation still slow the finish.",
      },
      {
        title: "Calling to book a doctor appointment",
        theme: "Phone scheduling",
        tries: 16,
        bestScore: 88,
        latestScore: 84,
        fluency: 82,
        vocabulary: 86,
        politeness: 91,
        completion: 90,
        scoreTrend: [63, 70, 76, 82, 88],
        note: "Telephone openings are polished; time confirmations still need cleaner number delivery.",
      },
      {
        title: "Explaining medication timing",
        theme: "Dose instruction",
        tries: 13,
        bestScore: 82,
        latestScore: 79,
        fluency: 76,
        vocabulary: 84,
        politeness: 88,
        completion: 81,
        scoreTrend: [56, 63, 70, 76, 82],
        note: "Sequence words are correct, but learners still reorder time phrases mid-sentence.",
      },
      {
        title: "Post-test reassurance call",
        theme: "Empathy language",
        tries: 11,
        bestScore: 85,
        latestScore: 82,
        fluency: 81,
        vocabulary: 82,
        politeness: 94,
        completion: 86,
        scoreTrend: [60, 68, 74, 80, 85],
        note: "Excellent reassurance phrases. AI wants fewer filler resets before clinical detail.",
      },
    ],
    recentAttempts: [
      { learner: "Arjun T.", scenario: "Hospital check-in desk", attemptAt: "Today, 10:05", aiScore: 86, fluency: 84, status: "Stable" },
      { learner: "Richa N.", scenario: "Calling to book a doctor appointment", attemptAt: "Today, 09:35", aiScore: 84, fluency: 83, status: "Coach review" },
      { learner: "Mansi K.", scenario: "Explaining medication timing", attemptAt: "Yesterday, 17:40", aiScore: 79, fluency: 75, status: "Needs repetition" },
      { learner: "Kabir P.", scenario: "Post-test reassurance call", attemptAt: "Yesterday, 16:20", aiScore: 82, fluency: 80, status: "Recovered" },
    ],
    vocabularySnapshot: {
      fillerWordRate: 5.8,
      fillerWordDelta: -0.9,
      phrasesMasteredThisWeek: 31,
      dictationCompletion: 84,
      aiConfidence: 79,
    },
    listeningDrills: [
      { title: "Reception desk dictation", difficulty: "Intermediate", accuracy: 81, attempts: 27, note: "Main misses happen on names and dates." },
      { title: "Medication timing playback", difficulty: "Advanced", accuracy: 74, attempts: 18, note: "Learners replay frequency and food instructions most often." },
      { title: "Nurse handover listening", difficulty: "Advanced", accuracy: 78, attempts: 15, note: "Clinical nouns land well, but rapid transitions still slip." },
    ],
    phraseBank: [
      { phrase: "Bitte nehmen Sie das Medikament nach dem Essen.", category: "Medication", mastery: 77, timesUsed: 29, note: "Meaning is clear; rhythm is still mechanical." },
      { phrase: "Wann passt Ihnen der naechste Termin?", category: "Appointments", mastery: 84, timesUsed: 36, note: "Telephone delivery is increasingly natural." },
      { phrase: "Ich stelle Ihnen noch ein paar Fragen.", category: "Intake", mastery: 88, timesUsed: 41, note: "Strong transition phrase for patient history." },
      { phrase: "Bitte sagen Sie mir, wo die Schmerzen sind.", category: "Assessment", mastery: 79, timesUsed: 24, note: "AI asks for softer pacing on the second clause." },
      { phrase: "Ich erklaere Ihnen jetzt den Ablauf.", category: "Reassurance", mastery: 82, timesUsed: 22, note: "Calm tone is consistent across attempts." },
    ],
    confidenceMatrix: [
      { label: "Patient intake", x: 80, y: 88, size: 17, tone: "success" },
      { label: "Medication timing", x: 58, y: 76, size: 19, tone: "warning" },
      { label: "Appointment call", x: 73, y: 84, size: 15, tone: "info" },
      { label: "Reassurance script", x: 82, y: 85, size: 14, tone: "accent" },
    ],
    feedbackThemes: [
      { theme: "Time sequencing", count: 16, detail: "Before, after, and every day phrases still reorder under pressure." },
      { theme: "Compound nouns", count: 13, detail: "Long medical words need chunked rehearsal inside full sentences." },
      { theme: "Question melody", count: 9, detail: "The AI still asks for a warmer rise on patient prompts." },
    ],
    practiceRituals: [
      { title: "Dose ladder", detail: "Start with single-instruction lines, then stack timing, food, and confirmation language." },
      { title: "Question melody drill", detail: "Read intake questions in three emotional tones to loosen flat delivery." },
      { title: "Compound chunk relay", detail: "Split medical nouns into beat groups before returning to real tempo." },
    ],
  },
  {
    id: "hospitality-frontdesk-batch",
    code: "GTS-LL-HOT-03",
    name: "Hotel Front Desk Language Sprint",
    track: "Hospitality Communication",
    coach: "Felix Thomas",
    snapshotLabel: "4-week polish sprint",
    summary:
      "Hospitality phrases sound smooth at check-in, but the batch still hesitates around complaint recovery and local recommendation language.",
    overview: {
      sessionsThisWeek: 19,
      avgPronunciation: 79,
      avgRoleplay: 77,
      listeningAccuracy: 75,
      phraseMastery: 69,
      flaggedLearners: 5,
      totalLearners: 20,
      streakSessions: 27,
      activeRoleplays: 4,
    },
    weeklyRoleplay: [
      { label: "Wk 1", sessions: 10, avgScore: 64 },
      { label: "Wk 2", sessions: 14, avgScore: 68 },
      { label: "Wk 3", sessions: 17, avgScore: 73 },
      { label: "Wk 4", sessions: 19, avgScore: 77 },
    ],
    pronunciationCategories: [
      { label: "Guest greeting", score: 83, delta: 5, tone: "success" },
      { label: "Complaint recovery", score: 72, delta: 4, tone: "warning" },
      { label: "Recommendation language", score: 74, delta: 6, tone: "accent" },
      { label: "Phone responses", score: 78, delta: 5, tone: "info" },
    ],
    cefrReadiness: [
      { label: "A2 Stable", learners: 6, target: "Standard check-in prompts" },
      { label: "A2+ Moving", learners: 7, target: "Longer recommendation language" },
      { label: "B1 Ready", learners: 5, target: "Complaint handling with support" },
      { label: "B1 Strong", learners: 2, target: "Independent front-desk recovery" },
    ],
    blockers: [
      { label: "Complaint de-escalation", share: 68, note: "Learners sound polite, but not yet naturally reassuring." },
      { label: "Local recommendations", share: 57, note: "Vocabulary is broad, but sentence linking still breaks." },
      { label: "Check-out billing language", share: 51, note: "Amounts and add-on explanations need cleaner pacing." },
    ],
    spotlight: {
      learner: "Devika R.",
      focus: "Check-out and billing explanations",
      improvement: "+7 points in phone and desk recovery scenarios",
      lastSession: "Today, 11:20",
      note: "The AI marked stronger eye-contact pacing cues and clearer escalation phrases.",
    },
    pronunciationWords: [
      {
        word: "Rezeption",
        context: "Front-desk welcome",
        tries: 14,
        bestScore: 87,
        averageScore: 81,
        consistency: 76,
        stressAccuracy: 84,
        vowelLength: 74,
        trend: [63, 70, 76, 82, 87],
        aiTag: "Better syllable lift after greeting warm-ups",
      },
      {
        word: "Zimmerkarte",
        context: "Key card handover",
        tries: 11,
        bestScore: 84,
        averageScore: 78,
        consistency: 74,
        stressAccuracy: 80,
        vowelLength: 71,
        trend: [58, 66, 71, 77, 84],
        aiTag: "Compound split improved on the last two attempts",
      },
      {
        word: "Fruehstuecksbuffet",
        context: "Breakfast timing",
        tries: 9,
        bestScore: 81,
        averageScore: 75,
        consistency: 71,
        stressAccuracy: 78,
        vowelLength: 67,
        trend: [54, 61, 67, 74, 81],
        aiTag: "Long compounds still need a deliberate first beat",
      },
      {
        word: "Empfehlung",
        context: "Local recommendation",
        tries: 12,
        bestScore: 83,
        averageScore: 77,
        consistency: 72,
        stressAccuracy: 79,
        vowelLength: 70,
        trend: [57, 64, 70, 76, 83],
        aiTag: "AI flagged more natural phrasing once the learner slowed transitions",
      },
      {
        word: "Rechnung",
        context: "Check-out billing",
        tries: 10,
        bestScore: 82,
        averageScore: 76,
        consistency: 71,
        stressAccuracy: 77,
        vowelLength: 69,
        trend: [55, 62, 68, 74, 82],
        aiTag: "Better final ng resonance after mirror drills",
      },
      {
        word: "Auschecken",
        context: "Guest departure",
        tries: 13,
        bestScore: 85,
        averageScore: 79,
        consistency: 74,
        stressAccuracy: 82,
        vowelLength: 73,
        trend: [60, 67, 73, 79, 85],
        aiTag: "More stable diphthong handling on the last three runs",
      },
    ],
    phonemeHotspots: [
      { label: "fr / sch blends", score: 63, issue: "Long hospitality compounds still merge under speed." },
      { label: "billing numbers", score: 66, issue: "Number groups flatten during invoice explanations." },
      { label: "recommendation phrasing", score: 72, issue: "Pauses appear before descriptive adjectives." },
      { label: "final -ung endings", score: 74, issue: "Endings improve with slower reset cues." },
    ],
    pronunciationScoreBands: [
      { label: "90+", learners: 2 },
      { label: "80-89", learners: 7 },
      { label: "70-79", learners: 8 },
      { label: "Below 70", learners: 3 },
    ],
    roleplays: [
      {
        title: "Late-night hotel check-in",
        theme: "Guest welcome",
        tries: 15,
        bestScore: 86,
        latestScore: 82,
        fluency: 80,
        vocabulary: 84,
        politeness: 92,
        completion: 92,
        scoreTrend: [60, 68, 74, 80, 86],
        note: "Welcomes sound professional. AI asks for smoother transition into room details.",
      },
      {
        title: "Handling a noisy-room complaint",
        theme: "Service recovery",
        tries: 12,
        bestScore: 81,
        latestScore: 78,
        fluency: 75,
        vocabulary: 80,
        politeness: 90,
        completion: 84,
        scoreTrend: [56, 62, 69, 75, 81],
        note: "Empathy language is improving, but escalation phrases still sound scripted.",
      },
      {
        title: "Suggesting local places to visit",
        theme: "Recommendation language",
        tries: 11,
        bestScore: 80,
        latestScore: 77,
        fluency: 74,
        vocabulary: 81,
        politeness: 87,
        completion: 80,
        scoreTrend: [54, 61, 66, 72, 80],
        note: "Vocabulary is present, but sentence linking needs more spontaneity.",
      },
      {
        title: "Explaining check-out billing",
        theme: "Invoice clarity",
        tries: 10,
        bestScore: 79,
        latestScore: 76,
        fluency: 73,
        vocabulary: 78,
        politeness: 89,
        completion: 78,
        scoreTrend: [53, 60, 65, 71, 79],
        note: "Learners still pause before taxes, breakfast, and incidental charges.",
      },
    ],
    recentAttempts: [
      { learner: "Devika R.", scenario: "Late-night hotel check-in", attemptAt: "Today, 12:05", aiScore: 82, fluency: 80, status: "Stable" },
      { learner: "Nikhil S.", scenario: "Handling a noisy-room complaint", attemptAt: "Today, 11:10", aiScore: 78, fluency: 74, status: "Needs repetition" },
      { learner: "Fatima J.", scenario: "Suggesting local places to visit", attemptAt: "Yesterday, 18:55", aiScore: 77, fluency: 73, status: "Coach review" },
      { learner: "Arav P.", scenario: "Explaining check-out billing", attemptAt: "Yesterday, 18:05", aiScore: 76, fluency: 72, status: "Recovered" },
    ],
    vocabularySnapshot: {
      fillerWordRate: 7.1,
      fillerWordDelta: -0.6,
      phrasesMasteredThisWeek: 24,
      dictationCompletion: 79,
      aiConfidence: 75,
    },
    listeningDrills: [
      { title: "Guest request playback", difficulty: "Intermediate", accuracy: 78, attempts: 20, note: "Good on direct requests, weaker on implied complaints." },
      { title: "Check-out invoice recap", difficulty: "Advanced", accuracy: 72, attempts: 16, note: "Breakfast and tax items still require replay." },
      { title: "Local directions dialogue", difficulty: "Intermediate", accuracy: 76, attempts: 17, note: "Landmark vocabulary is improving each week." },
    ],
    phraseBank: [
      { phrase: "Ihr Zimmer ist jetzt bezugsfertig.", category: "Check-in", mastery: 85, timesUsed: 38, note: "Reliable opening phrase across the cohort." },
      { phrase: "Ich kuemmere mich sofort darum.", category: "Complaint handling", mastery: 79, timesUsed: 27, note: "Polite but still sounds memorized." },
      { phrase: "Darf ich Ihnen eine Empfehlung geben?", category: "Recommendations", mastery: 74, timesUsed: 19, note: "Better when paired with eye-contact pacing." },
      { phrase: "Hier ist Ihre Rechnung im Detail.", category: "Billing", mastery: 76, timesUsed: 16, note: "Invoice wording is clearer than the follow-up explanations." },
      { phrase: "Das Fruehstuecksbuffet beginnt um sieben Uhr.", category: "Guest information", mastery: 78, timesUsed: 22, note: "Compound stress still needs a stronger first beat." },
    ],
    confidenceMatrix: [
      { label: "Check-in welcome", x: 79, y: 86, size: 16, tone: "success" },
      { label: "Complaint recovery", x: 61, y: 75, size: 19, tone: "warning" },
      { label: "Local recommendation", x: 64, y: 72, size: 17, tone: "accent" },
      { label: "Billing explanation", x: 58, y: 74, size: 15, tone: "info" },
    ],
    feedbackThemes: [
      { theme: "Linking phrases", count: 14, detail: "Learners need smoother bridges between guest questions and responses." },
      { theme: "Repair language", count: 12, detail: "Complaint handling improves when apologies are followed by concrete action." },
      { theme: "Price narration", count: 9, detail: "Billing detail still sounds compressed under speed." },
    ],
    practiceRituals: [
      { title: "Complaint recovery ladder", detail: "Practice apology, action, and confirmation in one unbroken turn." },
      { title: "Invoice pace markers", detail: "Pause after each billing component before the total amount." },
      { title: "Recommendation trio", detail: "Give three local suggestions using the same sentence skeleton." },
    ],
  },
];