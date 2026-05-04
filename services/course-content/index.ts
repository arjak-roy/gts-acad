import "server-only";

export {
	listCourseContentService,
	listAssignedSharedCourseContentService,
	getContentByIdService,
	listCourseContentVersionsService,
	getCandidateAccessibleContentByIdService,
	getCandidateAccessibleResourceByIdService,
	searchCourseContentService,
} from "@/services/course-content/queries";
export type { CourseContentSearchItem } from "@/services/course-content/queries";
export { createContentService, updateContentService, deleteContentService, archiveContentService, cloneContentToCourseService, restoreCourseContentVersionService } from "@/services/course-content/commands";

export type {
	AssignedSharedContentListItem,
	CandidateContentDetail,
	ContentCreateResult,
	ContentDetail,
	ContentListItem,
} from "@/services/course-content/types";
