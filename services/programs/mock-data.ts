import { ProgramCreateResult } from "@/services/programs/types";

export const MOCK_PROGRAMS: ProgramCreateResult[] = [
  {
    id: "mock-program-1",
    courseId: "mock-course-language",
    courseName: "Language Career Track",
    slug: "german-language-b1",
    name: "German Language B1",
    type: "LANGUAGE",
    durationWeeks: 20,
    category: "Language",
    description: "Language preparation curriculum.",
    isActive: true,
  },
  {
    id: "mock-program-2",
    courseId: "mock-course-clinical",
    courseName: "Clinical Career Track",
    slug: "clinical-bridging",
    name: "Clinical Bridging",
    type: "CLINICAL",
    durationWeeks: 16,
    category: "Clinical",
    description: "Clinical transition curriculum.",
    isActive: true,
  },
];
