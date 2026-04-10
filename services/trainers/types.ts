export type TrainerOption = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
  isActive: boolean;
  courses: string[];
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
  courses: string[];
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
  courses: string[];
};
