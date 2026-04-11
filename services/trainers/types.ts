export const TRAINER_AVAILABILITY_STATUSES = ["AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"] as const;
export const TRAINER_AVAILABILITY_LABELS: Record<TrainerAvailabilityStatus, string> = {
  AVAILABLE: "Available",
  LIMITED: "Limited",
  UNAVAILABLE: "Unavailable",
  ON_LEAVE: "On Leave",
};

export type TrainerAvailabilityStatus = (typeof TRAINER_AVAILABILITY_STATUSES)[number];
export type TrainerStatus = "ACTIVE" | "INACTIVE";

export type TrainerOption = {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  specialization: string;
  isActive: boolean;
  availabilityStatus: TrainerAvailabilityStatus;
  courses: string[];
  lastActiveAt: string | null;
};

export type TrainerRegistryResponse = {
  items: TrainerOption[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filterOptions: {
    specializations: string[];
  };
};

export type TrainerCreateResult = {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string | null;
  specialization: string;
  bio: string | null;
  capacity: number;
  status: TrainerStatus;
  availabilityStatus: TrainerAvailabilityStatus;
  courses: string[];
  lastActiveAt: string | null;
};

export type TrainerDetail = {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string | null;
  specialization: string;
  bio: string | null;
  capacity: number;
  status: TrainerStatus;
  availabilityStatus: TrainerAvailabilityStatus;
  courses: string[];
  lastActiveAt: string | null;
};
