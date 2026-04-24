import { createSearchParams } from "@/lib/utils";
import { DashboardSearchInput } from "@/lib/validation-schemas/dashboard";
import { ftsSearchService } from "@/services/dashboard-search/fts-search";
import { searchAssessmentPoolsService } from "@/services/assessment-pool-service";
import { searchBatchesService } from "@/services/batches-service";
import { searchCentresService } from "@/services/centers-service";
import { searchCourseContentService } from "@/services/course-content-service";
import { searchCoursesService } from "@/services/courses-service";
import { searchCurriculumService } from "@/services/curriculum-service";
import { searchLanguageLabWordsService } from "@/services/language-lab-service";
import { searchLearnersService } from "@/services/learners-service";
import { searchLearningResourcesService } from "@/services/learning-resource-service";
import { searchProgramsService } from "@/services/programs-service";
import { searchTrainersService } from "@/services/trainers-service";
import { searchUsersService } from "@/services/users";
import { DashboardSearchGroup, DashboardSearchItem, DashboardSearchResult } from "@/types";

const RESULT_LIMIT = 5;

function buildGroup(key: DashboardSearchGroup["key"], label: string, items: DashboardSearchItem[]): DashboardSearchGroup | null {
  if (items.length === 0) {
    return null;
  }

  return {
    key,
    label,
    items,
  };
}

export async function searchDashboardService(input: DashboardSearchInput): Promise<DashboardSearchResult> {
  const query = input.query.trim();

  // Try FTS first (materialized view with ranking)
  const ftsResult = await ftsSearchService(query, RESULT_LIMIT);
  if (ftsResult) return ftsResult;

  // Fallback: direct Prisma queries in parallel
  const [
    learners,
    batches,
    trainers,
    programs,
    courses,
    assessments,
    curriculum,
    centres,
    courseContent,
    users,
    learningResources,
    languageLabWords,
  ] = await Promise.all([
    searchLearnersService(query, RESULT_LIMIT),
    searchBatchesService(query, RESULT_LIMIT),
    searchTrainersService(query, RESULT_LIMIT),
    searchProgramsService(query, RESULT_LIMIT),
    searchCoursesService(query, RESULT_LIMIT),
    searchAssessmentPoolsService(query, RESULT_LIMIT),
    searchCurriculumService(query, RESULT_LIMIT),
    searchCentresService(query, RESULT_LIMIT),
    searchCourseContentService(query, RESULT_LIMIT),
    searchUsersService(query, RESULT_LIMIT),
    searchLearningResourcesService(query, RESULT_LIMIT),
    searchLanguageLabWordsService(query, RESULT_LIMIT),
  ]);

  const learnerItems: DashboardSearchItem[] = learners.map((learner) => ({
    id: learner.id,
    section: "learners",
    title: learner.fullName,
    description: [learner.learnerCode, learner.email, learner.programName].filter(Boolean).join(" | "),
    href: `/learners?${createSearchParams({ search: query, id: learner.learnerCode })}`,
  }));

  const batchItems: DashboardSearchItem[] = batches.map((batch) => ({
    id: batch.id,
    section: "batches",
    title: `${batch.code} - ${batch.name}`,
    description: [batch.programName, batch.campus, batch.trainerNames.join(", ")].filter(Boolean).join(" | "),
    href: `/batches?${createSearchParams({ viewId: batch.id })}`,
  }));

  const trainerItems: DashboardSearchItem[] = trainers.map((trainer) => ({
    id: trainer.id,
    section: "trainers",
    title: trainer.fullName,
    description: [trainer.specialization, trainer.email].filter(Boolean).join(" | "),
    href: `/trainers?${createSearchParams({ viewId: trainer.id })}`,
  }));

  const programItems: DashboardSearchItem[] = programs.map((program) => ({
    id: program.id,
    section: "programs",
    title: program.name,
    description: `${program.courseName} | ${program.type} | ${program.isActive ? "Active" : "Inactive"}`,
    href: `/programs?${createSearchParams({ viewId: program.id })}`,
  }));

  const courseItems: DashboardSearchItem[] = courses.map((course) => ({
    id: course.id,
    section: "courses",
    title: course.name,
    description: [course.description, `${course.programCount} programs`].filter(Boolean).join(" | "),
    href: `/courses?${createSearchParams({ viewId: course.id })}`,
  }));

  const assessmentItems: DashboardSearchItem[] = assessments.map((pool) => ({
    id: pool.id,
    section: "assessments",
    title: pool.title,
    description: [pool.code, pool.questionType, pool.difficultyLevel, pool.status].filter(Boolean).join(" | "),
    href: `/assessments?${createSearchParams({ viewId: pool.id })}`,
    metadata: { status: pool.status, type: pool.questionType },
  }));

  const curriculumItems: DashboardSearchItem[] = curriculum.map((c) => ({
    id: c.id,
    section: "curriculum",
    title: c.title,
    description: [c.courseName, c.status].filter(Boolean).join(" | "),
    href: `/curriculum-builder?${createSearchParams({ viewId: c.id })}`,
    metadata: { status: c.status },
  }));

  const centreItems: DashboardSearchItem[] = centres.map((c) => ({
    id: c.id,
    section: "centres",
    title: c.name,
    description: [c.addressSummary, c.isActive ? "Active" : "Inactive"].filter(Boolean).join(" | "),
    href: `/centers?${createSearchParams({ viewId: c.id })}`,
    metadata: { compliance: c.complianceStatus },
  }));

  const courseContentItems: DashboardSearchItem[] = courseContent.map((item) => ({
    id: item.id,
    section: "course_content",
    title: item.title,
    description: [item.courseName, item.contentType, item.status].filter(Boolean).join(" | "),
    href: `/course-builder?${createSearchParams({ courseId: item.courseId, contentId: item.id })}`,
    metadata: { contentType: item.contentType, status: item.status },
  }));

  const userItems: DashboardSearchItem[] = users.map((u) => ({
    id: u.id,
    section: "users",
    title: u.name,
    description: [u.email, u.isActive ? "Active" : "Inactive"].filter(Boolean).join(" | "),
    href: `/users?${createSearchParams({ viewId: u.id })}`,
  }));

  const learningResourceItems: DashboardSearchItem[] = learningResources.map((r) => ({
    id: r.id,
    section: "learning_resources",
    title: r.title,
    description: [r.categoryName, r.contentType, r.visibility].filter(Boolean).join(" | "),
    href: `/course-builder?${createSearchParams({ tab: "resources", resourceId: r.id })}`,
    metadata: { contentType: r.contentType, status: r.status },
  }));

  const languageLabItems: DashboardSearchItem[] = languageLabWords.map((w) => ({
    id: w.id,
    section: "language_lab",
    title: w.word,
    description: [w.englishMeaning, `Difficulty: ${w.difficulty}`, w.isActive ? "Active" : "Inactive"].filter(Boolean).join(" | "),
    href: `/language-lab?${createSearchParams({ word: w.id })}`,
    metadata: { difficulty: String(w.difficulty) },
  }));

  const groups = [
    buildGroup("learners", "Learners", learnerItems),
    buildGroup("batches", "Batches", batchItems),
    buildGroup("trainers", "Trainers", trainerItems),
    buildGroup("courses", "Courses", courseItems),
    buildGroup("programs", "Programs", programItems),
    buildGroup("assessments", "Assessments", assessmentItems),
    buildGroup("curriculum", "Curriculum", curriculumItems),
    buildGroup("centres", "Training Centres", centreItems),
    buildGroup("course_content", "Course Content", courseContentItems),
    buildGroup("users", "Users", userItems),
    buildGroup("learning_resources", "Learning Resources", learningResourceItems),
    buildGroup("language_lab", "Language Lab", languageLabItems),
  ].filter((group): group is DashboardSearchGroup => Boolean(group));

  return {
    query,
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups,
  };
}
