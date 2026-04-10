import { CourseDetail } from "@/services/courses/types";

export const MOCK_COURSES: CourseDetail[] = [
  {
    id: "mock-course-language",
    name: "Language Career Track",
    description: "Language preparation pathways for international academy placement.",
    status: "PUBLISHED",
    isActive: true,
    programs: [{ id: "mock-program-1", name: "German Language B1", type: "LANGUAGE", isActive: true }],
    trainers: [],
    assignedSharedContents: [],
  },
  {
    id: "mock-course-clinical",
    name: "Clinical Career Track",
    description: "Clinical upskilling pathways for nursing and healthcare deployment.",
    status: "IN_REVIEW",
    isActive: true,
    programs: [{ id: "mock-program-2", name: "Clinical Bridging", type: "CLINICAL", isActive: true }],
    trainers: [],
    assignedSharedContents: [],
  },
];
