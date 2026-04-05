import "server-only";

export { archiveTrainerService, createTrainerService, updateTrainerService } from "@/services/trainers/commands";
export {
  getTrainerByIdService,
  getTrainersForProgramService,
  listTrainersService,
  searchTrainersService,
} from "@/services/trainers/queries";

export type { TrainerCreateResult, TrainerDetail, TrainerOption } from "@/services/trainers/types";
