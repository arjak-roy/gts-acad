import "server-only";

export {
	getScheduleEventByIdService,
	listScheduleEventsService,
	listScheduleLearnerOptionsService,
	listScheduleTrainerOptionsService,
} from "@/services/schedule/queries";
export {
	cancelScheduleEventService,
	cancelSessionService,
	completeSessionService,
	createScheduleEventService,
	rescheduleSessionService,
	updateScheduleEventService,
} from "@/services/schedule/commands";
export { checkTrainerConflicts, checkMultipleTrainerConflicts } from "@/services/schedule/conflict-detection";
export {
	assignTrainerToSession,
	assignTrainersToEvent,
	listTrainerAssignments,
	removeTrainerFromSession,
	updateTrainerSessionRole,
} from "@/services/schedule/trainer-assignment";
export { getSessionHistory, logSessionEvent } from "@/services/schedule/session-history";
export {
	notifyTrainerOfAssignment,
	notifyTrainersOfSessionCancelled,
	notifyTrainersOfSessionCreated,
	notifyTrainersOfSessionRescheduled,
} from "@/services/schedule/trainer-notifications";

export type {
	LiveClassProviderType,
	ScheduleContextOption,
	ScheduleEventListItem,
	ScheduleEventListResponse,
	ScheduleEventWithTrainers,
	SessionTypeValue,
	TrainerAssignmentInput,
	TrainerSessionRoleValue,
} from "@/services/schedule/types";
export type { ConflictCheckResult, ConflictInfo } from "@/services/schedule/conflict-detection";
export type { TrainerAssignmentDetail } from "@/services/schedule/trainer-assignment";
export type { SessionHistoryEntry } from "@/services/schedule/session-history";
