import { TrainerOption } from "@/services/trainers/types";

export const MOCK_TRAINERS: TrainerOption[] = [
  {
    id: "mock-trainer-1",
    fullName: "Dr. Markus Stein",
    email: "markus.trainer@gts-academy.test",
    specialization: "German Language",
    isActive: true,
    programs: ["German Language B1", "German Language B2"],
  },
];
