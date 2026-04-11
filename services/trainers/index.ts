import "server-only";

export {
  archiveTrainerService,
  createTrainerService,
  updateTrainerCoursesService,
  updateTrainerService,
  updateTrainerStatusService,
} from "@/services/trainers/commands";
export {
  getTrainerByIdService,
  getTrainerRegistryService,
  getTrainersForCourseService,
  listTrainersService,
  searchTrainersService,
} from "@/services/trainers/queries";

export type {
  TrainerAvailabilityStatus,
  TrainerCreateResult,
  TrainerDetail,
  TrainerOption,
  TrainerRegistryResponse,
  TrainerStatus,
} from "@/services/trainers/types";
