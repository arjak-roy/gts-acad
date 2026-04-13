export type LanguageLabWordItem = {
  id: string;
  word: string;
  normalizedWord: string;
  englishMeaning: string | null;
  phonetic: string | null;
  difficulty: number;
  source: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pronunciationAttemptsCount: number;
  lastPracticedAt: string | null;
};

export type LanguageLabVocabBankImportIssue = {
  field: string | null;
  message: string;
};

export type LanguageLabVocabBankImportRowInput = {
  word: string;
  englishMeaning: string;
  phonetic: string;
  difficulty: string;
  source: string;
  isActive: string;
};

export type LanguageLabVocabBankImportNormalizedRow = {
  rowNumber: number;
  word: string;
  englishMeaning: string;
  phonetic: string;
  difficulty: number;
  source: string;
  isActive: boolean;
};

export type LanguageLabVocabBankImportRow = {
  rowNumber: number;
  status: "create" | "update" | "error";
  input: LanguageLabVocabBankImportRowInput;
  normalizedWord: string | null;
  existingWordId: string | null;
  existingWord: string | null;
  normalizedData: LanguageLabVocabBankImportNormalizedRow | null;
  issues: LanguageLabVocabBankImportIssue[];
};

export type LanguageLabVocabBankImportPreview = {
  fileName: string;
  headers: string[];
  totalRows: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  actionableCount: number;
  hasBlockingErrors: boolean;
  rows: LanguageLabVocabBankImportRow[];
};

export type LanguageLabVocabBankImportCommitResult = {
  fileName: string;
  createdCount: number;
  updatedCount: number;
  totalCount: number;
};

export type LanguageLabBuddyPersonaCourseAssignment = {
  courseId: string;
  courseName: string;
  courseStatus: string;
  isCourseActive: boolean;
  assignedAt: string;
};

export type LanguageLabBuddyPersonaItem = {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  language: string;
  languageCode: string;
  systemPrompt: string | null;
  welcomeMessage: string | null;
  supportsTables: boolean;
  supportsEmailActions: boolean;
  supportsSpeech: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  assignedCourses: LanguageLabBuddyPersonaCourseAssignment[];
};

export type CandidateBuddyPersona = {
  id: string;
  name: string;
  description: string | null;
  language: string;
  languageCode: string;
  systemPrompt: string | null;
  welcomeMessage: string | null;
  supportsTables: boolean;
  supportsEmailActions: boolean;
  supportsSpeech: boolean;
};

export type LanguageLabAnalyticsAppliedFilters = {
  search: string;
  batchId: string | null;
  learnerId: string | null;
};

export type LanguageLabAnalyticsFilterOption = {
  value: string;
  label: string;
  detail: string | null;
};

export type LanguageLabAnalyticsFilterOptions = {
  batches: LanguageLabAnalyticsFilterOption[];
  learners: LanguageLabAnalyticsFilterOption[];
};

export type LanguageLabWordProgressRow = {
  wordId: string;
  word: string;
  englishMeaning: string | null;
  phonetic: string | null;
  difficulty: number;
  source: string;
  isActive: boolean;
  attemptsCount: number;
  uniqueLearnersCount: number;
  averageScore: number | null;
  bestScore: number | null;
  latestScore: number | null;
  lastPracticedAt: string | null;
};

export type LanguageLabWordProgressAnalytics = {
  filters: LanguageLabAnalyticsAppliedFilters;
  filterOptions: LanguageLabAnalyticsFilterOptions;
  overview: {
    catalogWordsCount: number;
    activeWordsCount: number;
    practicedWordsCount: number;
    uniqueLearnersCount: number;
    averageScore: number | null;
    lastPracticedAt: string | null;
  };
  rows: LanguageLabWordProgressRow[];
};

export type LanguageLabPronunciationWeakWord = {
  word: string;
  englishMeaning: string | null;
  attemptsCount: number;
  averageScore: number;
  latestAttemptAt: string | null;
  topPriority: string | null;
};

export type LanguageLabPronunciationLatestAttempt = {
  id: string;
  learnerName: string;
  learnerCode: string;
  batchName: string;
  batchCode: string;
  word: string;
  englishMeaning: string | null;
  phonetic: string | null;
  score: number;
  heardText: string | null;
  priorities: string[];
  strengths: string[];
  nextTryInstruction: string | null;
  createdAt: string;
};

export type LanguageLabPronunciationPriorityTheme = {
  label: string;
  count: number;
};

export type LanguageLabPronunciationPhonemeHotspot = {
  phoneme: string;
  incorrectCount: number;
  partialCount: number;
  correctCount: number;
};

export type LanguageLabPronunciationAnalytics = {
  filters: LanguageLabAnalyticsAppliedFilters;
  filterOptions: LanguageLabAnalyticsFilterOptions;
  overview: {
    totalAttempts: number;
    averageScore: number | null;
    lowScoreAttemptsCount: number;
    uniqueLearnersCount: number;
    uniqueWordsCount: number;
    lastAttemptAt: string | null;
  };
  weakestWords: LanguageLabPronunciationWeakWord[];
  latestAttempts: LanguageLabPronunciationLatestAttempt[];
  priorityThemes: LanguageLabPronunciationPriorityTheme[];
  phonemeHotspots: LanguageLabPronunciationPhonemeHotspot[];
};

export type LanguageLabRoleplayScenarioSummary = {
  scenarioName: string;
  sessionsCount: number;
  completionRate: number;
  averageSpendEur: number;
  averageTurns: number;
  lastOccurredAt: string | null;
};

export type LanguageLabRoleplayLearnerSummary = {
  learnerId: string;
  learnerName: string;
  learnerCode: string;
  batchName: string;
  batchCode: string;
  sessionsCount: number;
  completionRate: number;
  averageSpendEur: number;
  latestOccurredAt: string | null;
};

export type LanguageLabRoleplayLatestSession = {
  id: string;
  scenarioName: string;
  learnerName: string;
  learnerCode: string;
  batchName: string;
  batchCode: string;
  budgetEur: number;
  totalSpentEur: number;
  acceptedDeals: number;
  transactionCount: number;
  turnCount: number;
  dealComplete: boolean;
  missionFailed: boolean;
  occurredAt: string;
};

export type LanguageLabRoleplayAnalytics = {
  filters: LanguageLabAnalyticsAppliedFilters;
  filterOptions: LanguageLabAnalyticsFilterOptions;
  overview: {
    totalSessions: number;
    completionRate: number;
    averageSpendEur: number;
    averageTurns: number;
    uniqueLearnersCount: number;
    lastOccurredAt: string | null;
  };
  scenarioBreakdown: LanguageLabRoleplayScenarioSummary[];
  learnerHighlights: LanguageLabRoleplayLearnerSummary[];
  latestSessions: LanguageLabRoleplayLatestSession[];
};