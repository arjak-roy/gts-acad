import "server-only";

import { searchLearnersService } from "@/services/learners-service";
import { searchBatchesService } from "@/services/batches-service";
import { searchTrainersService } from "@/services/trainers-service";
import { searchCoursesService } from "@/services/courses-service";
import { searchProgramsService } from "@/services/programs-service";
import { createSearchParams } from "@/lib/utils";
import { DashboardSearchInput } from "@/lib/validation-schemas/dashboard";
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

/**
 * Searches across dashboard-relevant operational entities so the dashboard can act as a global command surface.
 * Returns small grouped result sets that are cheap to render and easy to scan.
 */
export async function searchDashboardService(input: DashboardSearchInput): Promise<DashboardSearchResult> {
  const query = input.query.trim();

  const [learners, batches, trainers, programs, courses] = await Promise.all([
    searchLearnersService(query, RESULT_LIMIT),
    searchBatchesService(query, RESULT_LIMIT),
    searchTrainersService(query, RESULT_LIMIT),
    searchProgramsService(query, RESULT_LIMIT),
    searchCoursesService(query, RESULT_LIMIT),
  ]);

  const learnerItems: DashboardSearchItem[] = learners.map((learner) => ({
    id: learner.id,
    section: "learners",
    title: learner.fullName,
    description: [learner.learnerCode, learner.email, learner.programName].filter(Boolean).join(" | "),
    href: `/staff/learners?${createSearchParams({ search: query, id: learner.learnerCode })}`,
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

  const groups = [
    buildGroup("learners", "Learners", learnerItems),
    buildGroup("batches", "Batches", batchItems),
    buildGroup("trainers", "Trainers", trainerItems),
    buildGroup("courses", "Courses", courseItems),
    buildGroup("programs", "Programs", programItems),
  ].filter((group): group is DashboardSearchGroup => Boolean(group));

  return {
    query,
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups,
  };
}