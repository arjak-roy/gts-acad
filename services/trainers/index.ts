import "server-only";

export {
  archiveTrainerService,
  createTrainerService,
  updateTrainerCoursesService,
  updateTrainerProfilePhotoService,
  updateTrainerService,
  updateTrainerStatusService,
} from "@/services/trainers/commands";
export {
  getTrainerByIdService,
  getTrainerRegistryService,
  getTrainersForCourseService,
  getTrainerStatusHistoryService,
  listTrainersService,
  searchTrainersService,
} from "@/services/trainers/queries";
export {
  getTrainerPerformanceService,
  listTrainerActivityService,
} from "@/services/trainers/insights";
export {
  getTrainerCalendar,
  getTrainerCalendarStats,
  getTrainerPastSessions,
  getTrainerUpcomingSessions,
} from "@/services/trainers/calendar";
export { commitTrainerImportService, previewTrainerImportService } from "@/services/trainers/import";

export type {
  TrainerAvailabilityStatus,
  TrainerCreateResult,
  TrainerDetail,
  TrainerImportCommitResult,
  TrainerImportNormalizedRow,
  TrainerImportPreview,
  TrainerImportRow,
  TrainerImportRowInput,
  TrainerOption,
  TrainerPerformanceSummary,
  TrainerActivityItem,
  TrainerActivityResponse,
  TrainerActivityType,
  TrainerRegistryResponse,
  TrainerStatus,
  TrainerStatusHistoryItem,
} from "@/services/trainers/types";
export type {
  TrainerCalendarEvent,
  TrainerCalendarStats,
} from "@/services/trainers/calendar";
