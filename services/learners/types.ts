import { LearnerDetail } from "@/types";

export type LearnerSearchItem = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  programName: string | null;
  batchCode: string | null;
};

export type CandidateProfile = LearnerDetail & {
  userId: string;
  role: string;
  pathway: string;
};
