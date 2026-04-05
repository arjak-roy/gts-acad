import { BatchMode, BatchStatus } from "@prisma/client";

export type TrainerSummary = {
  id: string;
  fullName: string;
};

export type BatchRecord = {
  id: string;
  code: string;
  name: string;
  campus: string | null;
  status: BatchStatus;
  startDate: Date;
  endDate: Date | null;
  capacity: number;
  mode: BatchMode;
  schedule: string[];
  program: { name: string };
  trainer: { id: string; user: { name: string } } | null;
  trainers: Array<{ id: string; user: { name: string } }>;
};

export type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: BatchStatus;
  trainerIds: string[];
  trainerNames: string[];
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  mode?: BatchMode;
  schedule?: string[];
};

export type BatchCreateResult = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  startDate: string;
  endDate: string | null;
  capacity: number;
  mode: BatchMode;
  status: BatchStatus;
  trainerIds: string[];
  trainerNames: string[];
};
