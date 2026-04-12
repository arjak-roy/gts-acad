type TrainerCourseAssignmentsRecord = {
  courseAssignments: Array<{
    course: {
      id: string;
      name: string;
      isActive?: boolean;
    };
  }>;
};

function normalizeCourseName(value: string) {
  return value.trim().toLowerCase();
}

export function mapTrainerCourseNames(record: TrainerCourseAssignmentsRecord) {
  return record.courseAssignments.map((assignment) => assignment.course.name);
}

export function trainerHasCourseId(record: TrainerCourseAssignmentsRecord, courseId: string) {
  return record.courseAssignments.some((assignment) => assignment.course.id === courseId);
}

export function trainerHasCourseName(record: TrainerCourseAssignmentsRecord, courseName: string) {
  const normalizedCourseName = normalizeCourseName(courseName);
  return record.courseAssignments.some((assignment) => normalizeCourseName(assignment.course.name) === normalizedCourseName);
}