export type TrainerCourseOption = {
  id: string;
  name: string;
  isActive: boolean;
  isAssigned: boolean;
  source: "catalog" | "legacy";
};

function normalizeCourseName(value: string) {
  return value.trim().toLowerCase();
}

export function buildTrainerCourseSelections(
  courseOptions: Array<{ id: string; name: string; isActive: boolean }>,
  assignedCourseNames: string[],
) {
  const normalizedAssignedNames = Array.from(
    new Set(assignedCourseNames.map((courseName) => courseName.trim()).filter(Boolean)),
  );
  const assignedNameSet = new Set(normalizedAssignedNames.map(normalizeCourseName));
  const courseOptionsByNormalizedName = new Map(
    courseOptions.map((course) => [normalizeCourseName(course.name), course]),
  );

  const options: TrainerCourseOption[] = courseOptions
    .filter((course) => course.isActive || assignedNameSet.has(normalizeCourseName(course.name)))
    .map((course) => ({
      ...course,
      isAssigned: assignedNameSet.has(normalizeCourseName(course.name)),
      source: "catalog" as const,
    }));

  const selectedValues = options
    .filter((course) => course.isAssigned)
    .map((course) => course.id);

  normalizedAssignedNames.forEach((courseName) => {
    if (courseOptionsByNormalizedName.has(normalizeCourseName(courseName))) {
      return;
    }

    options.push({
      id: courseName,
      name: courseName,
      isActive: false,
      isAssigned: true,
      source: "legacy",
    });
    selectedValues.push(courseName);
  });

  return {
    options,
    selectedValues: Array.from(new Set(selectedValues)),
  };
}