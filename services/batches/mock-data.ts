import { BatchOption, TrainerSummary } from "@/services/batches/types";

export const MOCK_TRAINERS: TrainerSummary[] = [
  { id: "mock-trainer-1", fullName: "Dr. Markus Stein" },
  { id: "mock-trainer-2", fullName: "Dr. Leena Pillai" },
];

export const MOCK_BATCHES: BatchOption[] = [
  {
    id: "mock-batch-1",
    code: "B-GER-NOV",
    name: "German B1 November Cohort",
    programName: "German Language B1",
    centreId: "mock-center-1",
    campus: "Main Campus",
    centreAddress: "Infopark Phase 1, Kakkanad, Kochi, Kerala, India 682042",
    status: "IN_SESSION",
    trainerIds: ["mock-trainer-1", "mock-trainer-2"],
    trainerNames: ["Dr. Markus Stein", "Dr. Leena Pillai"],
    startDate: new Date("2026-01-05T08:00:00Z").toISOString(),
    endDate: new Date("2026-06-05T08:00:00Z").toISOString(),
    capacity: 25,
    mode: "OFFLINE",
    schedule: ["MON", "TUE", "WED", "THU", "FRI"],
  },
  {
    id: "mock-batch-2",
    code: "B-CLI-OCT",
    name: "Clinical Bridging October Cohort",
    programName: "Clinical Bridging",
    centreId: "mock-center-2",
    campus: "North Campus",
    centreAddress: "Civil Line Road, Palarivattom, Kochi, Kerala, India 682025",
    status: "IN_SESSION",
    trainerIds: [],
    trainerNames: [],
    startDate: new Date("2026-02-01T09:00:00Z").toISOString(),
    endDate: new Date("2026-06-01T09:00:00Z").toISOString(),
    capacity: 20,
    mode: "OFFLINE",
    schedule: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
  },
];
