import { TrainerOption } from "@/services/trainers/types";

export const MOCK_TRAINERS: TrainerOption[] = [
  {
    id: "mock-trainer-1",
    fullName: "Dr. Markus Stein",
    employeeCode: "TRN-0001",
    email: "markus.trainer@gts-academy.test",
    specialization: "German Language",
    isActive: true,
    availabilityStatus: "AVAILABLE",
    courses: ["German Language"],
    lastActiveAt: new Date("2026-04-10T09:30:00.000Z").toISOString(),
    department: null,
    trainerStatus: "ACTIVE",
  },
];
