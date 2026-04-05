export type TrainerOption = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
  isActive: boolean;
  programs: string[];
};

export type TrainerCreateResult = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  bio: string | null;
  capacity: number;
  status: "ACTIVE" | "INACTIVE";
  programs: string[];
};

export type TrainerDetail = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  bio: string | null;
  capacity: number;
  status: "ACTIVE" | "INACTIVE";
  programs: string[];
};
