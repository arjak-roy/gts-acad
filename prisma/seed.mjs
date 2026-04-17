import {
  AssessmentMode,
  AssessmentType,
  AttendanceStatus,
  BatchMode,
  BatchStatus,
  CertificateStatus,
  CurriculumStatus,
  EnrollmentStatus,
  EvaluationStatus,
  InterviewType,
  PlacementStatus,
  PrismaClient,
  ProgramType,
  SettingType,
  SyncStatus,
  TrainerAvailabilityStatus,
} from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import settingsCatalog from "../lib/settings/settings-catalog.json" with { type: "json" };

import { loadLocalEnv } from "../scripts/load-local-env.mjs";

loadLocalEnv({ preserveKeys: (process.env.PRISMA_PRESERVE_ENV_KEYS ?? "").split(",").filter(Boolean) });

const prisma = new PrismaClient();

const makeUuid = (seed) => `00000000-0000-0000-0000-${seed.toString(16).padStart(12, "0")}`;

const hashPassword = (password) => {
  const normalizedPassword = password.trim();
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(normalizedPassword, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
};

const deriveCodePrefix = (value) => {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "GEN";
  }

  return normalized.slice(0, 3).padEnd(3, "X");
};

const formatEntityCode = (kind, value, sequence) => `${kind}-${deriveCodePrefix(value)}-${String(sequence).padStart(3, "0")}`;
const formatTrainerEmployeeCode = (sequence) => `TRN-${String(sequence).padStart(4, "0")}`;

async function resolveTrainerEmployeeCode({ userId, sequence }) {
  const existingTrainer = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { employeeCode: true },
  });

  if (existingTrainer?.employeeCode) {
    return existingTrainer.employeeCode;
  }

  let candidateSequence = sequence;

  while (true) {
    const candidateCode = formatTrainerEmployeeCode(candidateSequence);
    const conflictingTrainer = await prisma.trainerProfile.findFirst({
      where: { employeeCode: candidateCode },
      select: { userId: true },
    });

    if (!conflictingTrainer || conflictingTrainer.userId === userId) {
      return candidateCode;
    }

    candidateSequence += 1;
  }
}

const COURSES = [
  {
    name: "Language Career Track",
    description: "Language preparation pathways for international academy placement.",
    type: ProgramType.LANGUAGE,
  },
  {
    name: "Clinical Career Track",
    description: "Clinical upskilling pathways for nursing and healthcare deployment.",
    type: ProgramType.CLINICAL,
  },
  {
    name: "Technical Career Track",
    description: "Technical programs aligned with healthcare operations and IT roles.",
    type: ProgramType.TECHNICAL,
  },
];

const PROGRAMS = [
  { slug: "german-language-b1", name: "German Language B1", type: ProgramType.LANGUAGE, category: "Language", durationWeeks: 20 },
  { slug: "german-language-b2", name: "German Language B2", type: ProgramType.LANGUAGE, category: "Language", durationWeeks: 22 },
  { slug: "ielts-academic-fast-track", name: "IELTS Academic Fast Track", type: ProgramType.LANGUAGE, category: "Language", durationWeeks: 12 },
  { slug: "clinical-bridging", name: "Clinical Bridging", type: ProgramType.CLINICAL, category: "Clinical", durationWeeks: 16 },
  { slug: "nclex-prep-bootcamp", name: "NCLEX Prep Bootcamp", type: ProgramType.CLINICAL, category: "Clinical", durationWeeks: 14 },
  { slug: "osce-lab-readiness", name: "OSCE Lab Readiness", type: ProgramType.CLINICAL, category: "Clinical", durationWeeks: 10 },
  { slug: "healthcare-it-fundamentals", name: "Healthcare IT Fundamentals", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 12 },
  { slug: "medical-billing-rcm", name: "Medical Billing and RCM", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 11 },
  { slug: "ehr-data-quality", name: "EHR Data Quality", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 9 },
  { slug: "clinical-data-coordinator", name: "Clinical Data Coordinator", type: ProgramType.TECHNICAL, category: "Technical", durationWeeks: 13 },
];

const CURRICULUM_SEEDS = [
  {
    courseName: "Clinical Career Track",
    title: "Clinical Career Track Curriculum",
    description: "Structured stage-based progression for clinical deployment readiness across communication, safety, exam prep, and transition readiness.",
    moduleTitle: "Clinical Progression Roadmap",
    moduleDescription: "Single delivery module covering the full seeded clinical career journey from onboarding through final transition readiness.",
    stages: [
      {
        title: "Stage 1 · Onboarding and Goal Setting",
        description: "Introduce the pathway, baseline expectations, and personal deployment goals for the learner cohort.",
      },
      {
        title: "Stage 2 · Clinical Communication Foundations",
        description: "Focus on nurse-patient communication, escalation language, and workplace professionalism.",
      },
      {
        title: "Stage 3 · Medical Terminology and Documentation",
        description: "Reinforce documentation discipline, charting conventions, and critical medical vocabulary.",
      },
      {
        title: "Stage 4 · Patient Safety and Infection Control",
        description: "Cover patient-safety practices, hand hygiene, PPE protocols, and reporting responsibilities.",
      },
      {
        title: "Stage 5 · Core Nursing Skills Refresh",
        description: "Refresh essential bedside skills, observation routines, and clinical procedures used in deployment settings.",
      },
      {
        title: "Stage 6 · Clinical Case Review and Critical Thinking",
        description: "Build clinical reasoning through case reviews, prioritization, and decision-making drills.",
      },
      {
        title: "Stage 7 · NCLEX Strategy and Test Readiness",
        description: "Prepare learners for NCLEX-style questioning, pacing, and exam performance habits.",
      },
      {
        title: "Stage 8 · OSCE Simulation and Skill Validation",
        description: "Run OSCE-style scenarios to validate applied skills, communication, and clinical execution.",
      },
      {
        title: "Stage 9 · Interview and Deployment Readiness",
        description: "Train for interviews, employer expectations, handoff communication, and relocation readiness.",
      },
      {
        title: "Stage 10 · Final Evaluation and Transition Plan",
        description: "Close the pathway with readiness review, final checkpoints, and an individualized transition plan.",
      },
    ],
  },
];

const TRAINERS = [
  { name: "Dr. Markus Stein", email: "markus.trainer@gts-academy.test", phone: "+91-9000000002", specialization: "German Language", rating: 4.8 },
  { name: "Ms. Leena Pillai", email: "leena.trainer@gts-academy.test", phone: "+91-9000000003", specialization: "Clinical Communication", rating: 4.6 },
  { name: "Mr. Rahul Menon", email: "rahul.trainer@gts-academy.test", phone: "+91-9000000004", specialization: "NCLEX Strategy", rating: 4.5 },
  { name: "Dr. Sarah Jacob", email: "sarah.trainer@gts-academy.test", phone: "+91-9000000005", specialization: "OSCE Simulation", rating: 4.7 },
  { name: "Mr. Ajay Thomas", email: "ajay.trainer@gts-academy.test", phone: "+91-9000000006", specialization: "Healthcare IT", rating: 4.4 },
  { name: "Ms. Neha Varma", email: "neha.trainer@gts-academy.test", phone: "+91-9000000007", specialization: "Medical Coding", rating: 4.5 },
  { name: "Mr. Johan Roy", email: "johan.trainer@gts-academy.test", phone: "+91-9000000008", specialization: "Data Quality", rating: 4.3 },
  { name: "Ms. Priya Nair", email: "priya.trainer@gts-academy.test", phone: "+91-9000000009", specialization: "Interview Readiness", rating: 4.6 },
];

const TRAINING_CENTRES = [
  {
    id: makeUuid(9001),
    name: "GTS Main Campus",
    addressLine1: "Infopark Phase 1",
    addressLine2: "Kakkanad",
    landmark: "Near Phase 1 Bus Stop",
    postalCode: "682042",
    totalCapacity: 300,
    currentUtilization: 180,
    complianceStatus: "compliant",
  },
  {
    id: makeUuid(9002),
    name: "GTS North Campus",
    addressLine1: "Civil Line Road",
    addressLine2: "Palarivattom",
    landmark: "Opposite Metro Pillar 512",
    postalCode: "682025",
    totalCapacity: 180,
    currentUtilization: 96,
    complianceStatus: "pending",
  },
  {
    id: makeUuid(9003),
    name: "GTS Skills Annex",
    addressLine1: "Seaport Airport Road",
    addressLine2: "Thrikkakara",
    landmark: "Near Collectorate Junction",
    postalCode: "682021",
    totalCapacity: 120,
    currentUtilization: 54,
    complianceStatus: "compliant",
  },
];

const FIRST_NAMES = [
  "Aditya", "Meera", "Arjun", "Neha", "Rahul", "Priya", "Asha", "Kiran", "Vikram", "Anita",
  "Rohan", "Nisha", "Sandeep", "Divya", "Manoj", "Kavya", "Ravi", "Pooja", "Amit", "Sneha",
  "Varun", "Isha", "Deepak", "Anu", "Harish", "Swathi", "Nitin", "Lakshmi", "Yash", "Maya",
  "Gokul", "Riya", "Suresh", "Anjali", "Tarun", "Shreya", "Karthik", "Minal", "Dev", "Bhavana",
  "Arav", "Keerthi", "Ritesh", "Nandini", "Vivek", "Amritha", "Sai", "Pallavi", "Kunal", "Irene",
];

const LAST_NAMES = [
  "Sharma", "Nair", "Mehta", "Verma", "Reddy", "Thomas", "Pillai", "Menon", "Roy", "Iyer",
  "Singh", "Patel", "Das", "Mishra", "Khan", "Joshi", "Kapoor", "Bose", "Mathew", "George",
  "Yadav", "Chandra", "Kumar", "Fernandes", "Prasad", "Saxena", "Paul", "Rao", "Bhat", "Pandey",
  "Jain", "Banerjee", "Nanda", "Sethi", "Kulkarni", "Agarwal", "Malhotra", "Dutta", "Srinivasan", "Tripathi",
  "Chopra", "Bhatt", "Shetty", "Ghosh", "Kohli", "Rastogi", "Tiwari", "Lal", "Nambiar", "Raman",
];

const SYSTEM_ROLES = [
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Full access to all modules and actions" },
  { code: "ACADEMY_ADMIN", name: "Academy Admin", description: "Manage learners, courses, programs, batches, trainers, assessments" },
  { code: "TRAINER", name: "Trainer", description: "Schedule, attendance, assessments within assigned context" },
  { code: "CONTENT_MANAGER", name: "Content Manager", description: "Courses, programs, LMS, email templates" },
  { code: "SUPPORT_USER", name: "Support User", description: "Support tickets, learner view-only" },
  { code: "CANDIDATE", name: "Candidate", description: "Candidate app access (no admin portal permissions)" },
];

const PERMISSION_DEFINITIONS = [
  { module: "dashboard", action: "view", key: "dashboard.view", description: "View dashboard" },
  { module: "users", action: "view", key: "users.view", description: "View learners/users" },
  { module: "users", action: "create", key: "users.create", description: "Create learners/users" },
  { module: "users", action: "edit", key: "users.edit", description: "Edit learners/users" },
  { module: "users", action: "delete", key: "users.delete", description: "Delete learners/users" },
  { module: "staff_users", action: "view", key: "staff_users.view", description: "View internal users" },
  { module: "staff_users", action: "create", key: "staff_users.create", description: "Create internal users" },
  { module: "staff_users", action: "edit", key: "staff_users.edit", description: "Edit internal users" },
  { module: "staff_users", action: "delete", key: "staff_users.delete", description: "Deactivate internal users" },
  { module: "candidate_users", action: "view", key: "candidate_users.view", description: "View candidate users" },
  { module: "candidate_users", action: "create", key: "candidate_users.create", description: "Onboard candidate users" },
  { module: "candidate_users", action: "edit", key: "candidate_users.edit", description: "Edit candidate users" },
  { module: "candidate_users", action: "delete", key: "candidate_users.delete", description: "Deactivate candidate users" },
  { module: "notifications", action: "view", key: "notifications.view", description: "View push notification readiness and delivery history" },
  { module: "notifications", action: "send", key: "notifications.send", description: "Send push notifications to candidates and batches" },
  { module: "auth", action: "login", key: "auth.login", description: "Sign in to the academy admin portal" },
  { module: "auth", action: "manage", key: "auth.manage", description: "Manage authentication and account recovery" },
  { module: "sessions", action: "view", key: "sessions.view", description: "View active sessions" },
  { module: "sessions", action: "manage", key: "sessions.manage", description: "Manage active sessions and logout all devices" },
  { module: "courses", action: "view", key: "courses.view", description: "View courses" },
  { module: "courses", action: "create", key: "courses.create", description: "Create courses" },
  { module: "courses", action: "edit", key: "courses.edit", description: "Edit courses" },
  { module: "courses", action: "delete", key: "courses.delete", description: "Delete courses" },
  { module: "programs", action: "view", key: "programs.view", description: "View programs" },
  { module: "programs", action: "create", key: "programs.create", description: "Create programs" },
  { module: "programs", action: "edit", key: "programs.edit", description: "Edit programs" },
  { module: "programs", action: "delete", key: "programs.delete", description: "Delete programs" },
  { module: "batches", action: "view", key: "batches.view", description: "View batches" },
  { module: "batches", action: "create", key: "batches.create", description: "Create batches" },
  { module: "batches", action: "edit", key: "batches.edit", description: "Edit batches" },
  { module: "batches", action: "delete", key: "batches.delete", description: "Delete batches" },
  { module: "centers", action: "view", key: "centers.view", description: "View physical centers" },
  { module: "centers", action: "create", key: "centers.create", description: "Create physical centers" },
  { module: "centers", action: "edit", key: "centers.edit", description: "Edit physical centers" },
  { module: "centers", action: "delete", key: "centers.delete", description: "Archive physical centers" },
  { module: "trainers", action: "view", key: "trainers.view", description: "View trainers" },
  { module: "trainers", action: "create", key: "trainers.create", description: "Create trainers" },
  { module: "trainers", action: "edit", key: "trainers.edit", description: "Edit trainers" },
  { module: "trainers", action: "delete", key: "trainers.delete", description: "Archive trainers" },
  { module: "trainers", action: "manage", key: "trainers.manage", description: "Manage trainer assignments" },
  { module: "schedule", action: "view", key: "schedule.view", description: "View schedule" },
  { module: "schedule", action: "create", key: "schedule.create", description: "Create schedule events" },
  { module: "schedule", action: "edit", key: "schedule.edit", description: "Edit schedule events" },
  { module: "schedule", action: "delete", key: "schedule.delete", description: "Delete schedule events" },
  { module: "attendance", action: "view", key: "attendance.view", description: "View attendance" },
  { module: "attendance", action: "manage", key: "attendance.manage", description: "Mark/manage attendance" },
  { module: "assessments", action: "view", key: "assessments.view", description: "View assessments" },
  { module: "assessments", action: "create", key: "assessments.create", description: "Create assessments" },
  { module: "assessments", action: "edit", key: "assessments.edit", description: "Edit assessments" },
  { module: "assessments", action: "delete", key: "assessments.delete", description: "Delete assessments" },
  { module: "assessments", action: "publish", key: "assessments.publish", description: "Publish assessments" },
  { module: "certifications", action: "view", key: "certifications.view", description: "View certifications" },
  { module: "certifications", action: "create", key: "certifications.create", description: "Create certifications" },
  { module: "certifications", action: "edit", key: "certifications.edit", description: "Edit certifications" },
  { module: "certifications", action: "delete", key: "certifications.delete", description: "Delete certifications" },
  { module: "readiness", action: "view", key: "readiness.view", description: "View readiness" },
  { module: "readiness", action: "manage", key: "readiness.manage", description: "Manage readiness/sync" },
  { module: "lms", action: "view", key: "lms.view", description: "View LMS content" },
  { module: "lms", action: "create", key: "lms.create", description: "Create LMS content" },
  { module: "lms", action: "edit", key: "lms.edit", description: "Edit LMS content" },
  { module: "lms", action: "manage", key: "lms.manage", description: "Manage LMS settings" },
  { module: "quizzes", action: "view", key: "quizzes.view", description: "View quizzes" },
  { module: "quizzes", action: "create", key: "quizzes.create", description: "Create quizzes" },
  { module: "quizzes", action: "edit", key: "quizzes.edit", description: "Edit quizzes" },
  { module: "quizzes", action: "delete", key: "quizzes.delete", description: "Delete quizzes" },
  { module: "quizzes", action: "publish", key: "quizzes.publish", description: "Publish quizzes" },
  { module: "payments", action: "view", key: "payments.view", description: "View payments" },
  { module: "payments", action: "manage", key: "payments.manage", description: "Manage payments" },
  { module: "support", action: "view", key: "support.view", description: "View support tickets" },
  { module: "support", action: "manage", key: "support.manage", description: "Manage support tickets" },
  { module: "logs", action: "view", key: "logs.view", description: "View logs and actions" },
  { module: "settings", action: "view", key: "settings.view", description: "View settings" },
  { module: "settings", action: "edit", key: "settings.edit", description: "Edit settings" },
  { module: "settings", action: "manage", key: "settings.manage", description: "Manage settings categories and fields" },
  { module: "email_templates", action: "view", key: "email_templates.view", description: "View email templates" },
  { module: "email_templates", action: "create", key: "email_templates.create", description: "Create email templates" },
  { module: "email_templates", action: "edit", key: "email_templates.edit", description: "Edit email templates" },
  { module: "email_templates", action: "delete", key: "email_templates.delete", description: "Delete email templates" },
  { module: "roles", action: "view", key: "roles.view", description: "View roles and permissions" },
  { module: "roles", action: "create", key: "roles.create", description: "Create roles" },
  { module: "roles", action: "edit", key: "roles.edit", description: "Edit roles and permission assignments" },
  { module: "roles", action: "delete", key: "roles.delete", description: "Delete roles" },
  { module: "course_content", action: "view", key: "course_content.view", description: "View course content" },
  { module: "course_content", action: "create", key: "course_content.create", description: "Upload course content" },
  { module: "course_content", action: "edit", key: "course_content.edit", description: "Edit course content" },
  { module: "course_content", action: "delete", key: "course_content.delete", description: "Delete course content" },
  { module: "learning_resources", action: "view", key: "learning_resources.view", description: "View learning resources" },
  { module: "learning_resources", action: "create", key: "learning_resources.create", description: "Create learning resources" },
  { module: "learning_resources", action: "edit", key: "learning_resources.edit", description: "Edit learning resources" },
  { module: "learning_resources", action: "delete", key: "learning_resources.delete", description: "Delete learning resources" },
  { module: "learning_resources", action: "assign", key: "learning_resources.assign", description: "Assign learning resources" },
  { module: "course_content_folder", action: "view", key: "course_content_folder.view", description: "View course content folders" },
  { module: "course_content_folder", action: "create", key: "course_content_folder.create", description: "Create course content folders" },
  { module: "course_content_folder", action: "edit", key: "course_content_folder.edit", description: "Edit course content folders" },
  { module: "course_content_folder", action: "delete", key: "course_content_folder.delete", description: "Delete course content folders" },
  { module: "assessment_pool", action: "view", key: "assessment_pool.view", description: "View assessment pool" },
  { module: "assessment_pool", action: "create", key: "assessment_pool.create", description: "Create assessments in pool" },
  { module: "assessment_pool", action: "edit", key: "assessment_pool.edit", description: "Edit assessment pool items" },
  { module: "assessment_pool", action: "delete", key: "assessment_pool.delete", description: "Delete assessment pool items" },
  { module: "assessment_pool", action: "publish", key: "assessment_pool.publish", description: "Publish assessment pool items" },
  { module: "assessment_reviews", action: "view", key: "assessment_reviews.view", description: "View assessment review queue" },
  { module: "assessment_reviews", action: "manage", key: "assessment_reviews.manage", description: "Manage assessment review attempts" },
  { module: "assessment_reviews", action: "grade", key: "assessment_reviews.grade", description: "Manual grade assessment attempts" },
  { module: "batch_content", action: "view", key: "batch_content.view", description: "View batch content mappings" },
  { module: "batch_content", action: "assign", key: "batch_content.assign", description: "Assign content to batches" },
  { module: "batch_content", action: "remove", key: "batch_content.remove", description: "Remove content from batches" },
  { module: "curriculum", action: "view", key: "curriculum.view", description: "View curricula" },
  { module: "curriculum", action: "create", key: "curriculum.create", description: "Create curricula" },
  { module: "curriculum", action: "edit", key: "curriculum.edit", description: "Edit curricula" },
  { module: "curriculum", action: "delete", key: "curriculum.delete", description: "Delete curricula" },
  { module: "curriculum", action: "publish", key: "curriculum.publish", description: "Publish curricula" },
];

// SUPER_ADMIN gets implicit bypass in code — no explicit permissions needed.
// CANDIDATE gets no admin portal permissions.
const ROLE_PERMISSION_MAP = {
  ACADEMY_ADMIN: [
    "dashboard.view",
    "auth.login", "auth.manage",
    "sessions.view", "sessions.manage",
    "users.view", "users.create", "users.edit", "users.delete",
    "staff_users.view", "staff_users.create", "staff_users.edit", "staff_users.delete",
    "candidate_users.view", "candidate_users.create", "candidate_users.edit", "candidate_users.delete",
    "notifications.view", "notifications.send",
    "courses.view", "courses.create", "courses.edit", "courses.delete",
    "programs.view", "programs.create", "programs.edit", "programs.delete",
    "batches.view", "batches.create", "batches.edit", "batches.delete",
    "centers.view", "centers.create", "centers.edit", "centers.delete",
    "trainers.view", "trainers.create", "trainers.edit", "trainers.delete", "trainers.manage",
    "schedule.view", "schedule.create", "schedule.edit", "schedule.delete",
    "attendance.view", "attendance.manage",
    "assessments.view", "assessments.create", "assessments.edit", "assessments.delete", "assessments.publish",
    "certifications.view", "certifications.create", "certifications.edit", "certifications.delete",
    "readiness.view", "readiness.manage",
    "lms.view", "lms.create", "lms.edit", "lms.manage",
    "quizzes.view", "quizzes.create", "quizzes.edit", "quizzes.delete", "quizzes.publish",
    "payments.view", "payments.manage",
    "support.view", "support.manage",
    "logs.view",
    "settings.view", "settings.edit", "settings.manage",
    "email_templates.view", "email_templates.edit",
    "course_content.view", "course_content.create", "course_content.edit", "course_content.delete",
    "learning_resources.view", "learning_resources.create", "learning_resources.edit", "learning_resources.delete", "learning_resources.assign",
    "course_content_folder.view", "course_content_folder.create", "course_content_folder.edit", "course_content_folder.delete",
    "assessment_pool.view", "assessment_pool.create", "assessment_pool.edit", "assessment_pool.delete", "assessment_pool.publish",
    "assessment_reviews.view", "assessment_reviews.manage", "assessment_reviews.grade",
    "batch_content.view", "batch_content.assign", "batch_content.remove",
    "curriculum.view", "curriculum.create", "curriculum.edit", "curriculum.delete", "curriculum.publish",
  ],
  TRAINER: [
    "dashboard.view",
    "auth.login",
    "sessions.view", "sessions.manage",
    "courses.view",
    "programs.view",
    "batches.view",
    "trainers.view",
    "schedule.view", "schedule.create", "schedule.edit", "schedule.delete",
    "attendance.view", "attendance.manage",
    "assessments.view", "assessments.create", "assessments.edit",
    "certifications.view",
    "readiness.view",
    "lms.view",
    "quizzes.view", "quizzes.create", "quizzes.edit",
    "course_content.view",
    "learning_resources.view",
    "course_content_folder.view",
    "assessment_pool.view",
    "assessment_reviews.view", "assessment_reviews.manage", "assessment_reviews.grade",
    "batch_content.view", "batch_content.assign", "batch_content.remove",
    "curriculum.view",
  ],
  CONTENT_MANAGER: [
    "dashboard.view",
    "auth.login",
    "sessions.view", "sessions.manage",
    "courses.view", "courses.create", "courses.edit", "courses.delete",
    "programs.view", "programs.create", "programs.edit", "programs.delete",
    "assessments.view",
    "lms.view", "lms.create", "lms.edit", "lms.manage",
    "quizzes.view", "quizzes.create", "quizzes.edit", "quizzes.delete", "quizzes.publish",
    "email_templates.view", "email_templates.create", "email_templates.edit", "email_templates.delete",
    "course_content.view", "course_content.create", "course_content.edit", "course_content.delete",
    "learning_resources.view", "learning_resources.create", "learning_resources.edit", "learning_resources.delete", "learning_resources.assign",
    "course_content_folder.view", "course_content_folder.create", "course_content_folder.edit", "course_content_folder.delete",
    "assessment_pool.view", "assessment_pool.create", "assessment_pool.edit", "assessment_pool.delete", "assessment_pool.publish",
    "batch_content.view", "batch_content.assign", "batch_content.remove",
    "curriculum.view", "curriculum.create", "curriculum.edit", "curriculum.delete", "curriculum.publish",
  ],
  SUPPORT_USER: [
    "dashboard.view",
    "auth.login",
    "sessions.view", "sessions.manage",
    "users.view",
    "notifications.view",
    "support.view", "support.manage",
  ],
};

async function upsertUser({ email, name, phone, password }) {
  const hashedPassword = hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    update: { name, phone, password: hashedPassword, isActive: true },
    create: { email, name, phone, password: hashedPassword, isActive: true, metadata: {} },
  });
}

async function assignUserRole(userId, roleId) {
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

function placementForIndex(index) {
  if (index < 5) {
    return {
      placementStatus: PlacementStatus.PLACEMENT_READY,
      syncStatus: index < 3 ? SyncStatus.SYNCED : SyncStatus.NOT_SYNCED,
      isReadyForDeployment: true,
      readiness: 86 + (index % 5),
    };
  }

  if (index % 3 === 0) {
    return {
      placementStatus: PlacementStatus.IN_REVIEW,
      syncStatus: SyncStatus.NOT_SYNCED,
      isReadyForDeployment: false,
      readiness: 72 + (index % 8),
    };
  }

  return {
    placementStatus: PlacementStatus.NOT_READY,
    syncStatus: SyncStatus.NOT_SYNCED,
    isReadyForDeployment: false,
    readiness: 58 + (index % 10),
  };
}

async function seed() {
  // --- Seed RBAC: Roles ---
  const roleRecords = {};
  for (const roleDef of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description, isSystemRole: true, isActive: true },
      create: { name: roleDef.name, code: roleDef.code, description: roleDef.description, isSystemRole: true, isActive: true },
    });
    roleRecords[roleDef.code] = role;
  }

  // --- Seed RBAC: Permissions ---
  const permissionRecords = {};
  for (const permDef of PERMISSION_DEFINITIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: permDef.key },
      update: { module: permDef.module, action: permDef.action, description: permDef.description },
      create: { module: permDef.module, action: permDef.action, key: permDef.key, description: permDef.description },
    });
    permissionRecords[permDef.key] = perm;
  }

  // --- Seed RBAC: Role-Permission matrix ---
  for (const [roleCode, permKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = roleRecords[roleCode];
    for (const permKey of permKeys) {
      const perm = permissionRecords[permKey];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // --- Seed settings categories and definitions ---
  for (const categoryDef of settingsCatalog) {
    const category = await prisma.settingsCategory.upsert({
      where: { code: categoryDef.code },
      update: {
        name: categoryDef.name,
        description: categoryDef.description ?? null,
        icon: categoryDef.icon ?? null,
        displayOrder: categoryDef.displayOrder,
        isSystem: categoryDef.isSystem !== false,
        isActive: true,
      },
      create: {
        name: categoryDef.name,
        code: categoryDef.code,
        description: categoryDef.description ?? null,
        icon: categoryDef.icon ?? null,
        displayOrder: categoryDef.displayOrder,
        isSystem: categoryDef.isSystem !== false,
        isActive: true,
      },
    });

    for (const settingDef of categoryDef.settings) {
      await prisma.setting.upsert({
        where: { key: settingDef.key },
        update: {
          categoryId: category.id,
          label: settingDef.label,
          description: settingDef.description ?? null,
          type: settingDef.type ?? SettingType.TEXT,
          defaultValue: settingDef.defaultValue ?? null,
          placeholder: settingDef.placeholder ?? null,
          helpText: settingDef.helpText ?? null,
          options: settingDef.options ?? null,
          validationRules: settingDef.validationRules ?? null,
          groupName: settingDef.groupName ?? null,
          displayOrder: settingDef.displayOrder,
          isRequired: settingDef.isRequired === true,
          isEncrypted: settingDef.isEncrypted === true,
          isReadonly: settingDef.isReadonly === true,
          isSystem: settingDef.isSystem !== false,
          isActive: settingDef.isActive !== false,
        },
        create: {
          categoryId: category.id,
          key: settingDef.key,
          label: settingDef.label,
          description: settingDef.description ?? null,
          type: settingDef.type ?? SettingType.TEXT,
          defaultValue: settingDef.defaultValue ?? null,
          placeholder: settingDef.placeholder ?? null,
          helpText: settingDef.helpText ?? null,
          options: settingDef.options ?? null,
          validationRules: settingDef.validationRules ?? null,
          groupName: settingDef.groupName ?? null,
          displayOrder: settingDef.displayOrder,
          isRequired: settingDef.isRequired === true,
          isEncrypted: settingDef.isEncrypted === true,
          isReadonly: settingDef.isReadonly === true,
          isSystem: settingDef.isSystem !== false,
          isActive: settingDef.isActive !== false,
        },
      });
    }
  }

  // --- Seed admin user ---
  const adminUser = await upsertUser({
    email: "arjakroy2411@gmail.com",
    name: "Academy Admin",
    phone: "+91-9000000001",
    password: "dev-password",
  });
  await assignUserRole(adminUser.id, roleRecords.SUPER_ADMIN.id);

  // --- Seed additional test users for each role ---
  const academyAdminUser = await upsertUser({
    email: "academyadmin@gts-academy.test",
    name: "Academy Admin User",
    phone: "+91-9000000050",
    password: "dev-password",
  });
  await assignUserRole(academyAdminUser.id, roleRecords.ACADEMY_ADMIN.id);

  const contentMgrUser = await upsertUser({
    email: "contentmgr@gts-academy.test",
    name: "Content Manager",
    phone: "+91-9000000051",
    password: "dev-password",
  });
  await assignUserRole(contentMgrUser.id, roleRecords.CONTENT_MANAGER.id);

  const supportUser = await upsertUser({
    email: "supportuser@gts-academy.test",
    name: "Support User",
    phone: "+91-9000000052",
    password: "dev-password",
  });
  await assignUserRole(supportUser.id, roleRecords.SUPPORT_USER.id);

  await prisma.currency.upsert({ where: { code: "INR" }, update: { symbol: "Rs" }, create: { code: "INR", symbol: "Rs" } });

  const india = await prisma.country.upsert({
    where: { isoCode: "IN" },
    update: { name: "India" },
    create: { name: "India", isoCode: "IN" },
  });

  const kerala = await prisma.state.upsert({
    where: { id: 1 },
    update: { name: "Kerala", countryId: india.id },
    create: { id: 1, name: "Kerala", countryId: india.id },
  });

  const kochi = await prisma.city.upsert({
    where: { id: 1 },
    update: { name: "Kochi", stateId: kerala.id },
    create: { id: 1, name: "Kochi", stateId: kerala.id },
  });

  const centreRecords = [];
  for (const centreDef of TRAINING_CENTRES) {
    const centre = await prisma.trainingCentre.upsert({
      where: { id: centreDef.id },
      update: {
        name: centreDef.name,
        addressLine1: centreDef.addressLine1,
        addressLine2: centreDef.addressLine2,
        landmark: centreDef.landmark,
        postalCode: centreDef.postalCode,
        locationId: kochi.id,
        totalCapacity: centreDef.totalCapacity,
        currentUtilization: centreDef.currentUtilization,
        complianceStatus: centreDef.complianceStatus,
        infrastructure: { labs: 4, classrooms: 8 },
        isActive: true,
      },
      create: {
        id: centreDef.id,
        name: centreDef.name,
        addressLine1: centreDef.addressLine1,
        addressLine2: centreDef.addressLine2,
        landmark: centreDef.landmark,
        postalCode: centreDef.postalCode,
        locationId: kochi.id,
        totalCapacity: centreDef.totalCapacity,
        currentUtilization: centreDef.currentUtilization,
        complianceStatus: centreDef.complianceStatus,
        infrastructure: { labs: 4, classrooms: 8 },
        isActive: true,
      },
    });

    centreRecords.push(centre);
  }

  const courseRecords = [];
  for (const course of COURSES) {
    const courseSequence = courseRecords.filter((record) => deriveCodePrefix(record.name) === deriveCodePrefix(course.name)).length + 1;
    const record = await prisma.course.upsert({
      where: { name: course.name },
      update: {
        code: formatEntityCode("C", course.name, courseSequence),
        description: course.description,
        isActive: true,
      },
      create: {
        code: formatEntityCode("C", course.name, courseSequence),
        name: course.name,
        description: course.description,
        isActive: true,
      },
    });

    courseRecords.push(record);
  }

  const courseByType = new Map(courseRecords.map((course, index) => [COURSES[index].type, course]));

  const seededCurricula = [];
  for (const curriculumSeed of CURRICULUM_SEEDS) {
    const seededCourse = courseRecords.find((course) => course.name === curriculumSeed.courseName);

    if (!seededCourse) {
      throw new Error(`Missing seeded course for curriculum ${curriculumSeed.title}.`);
    }

    const curriculum = await prisma.curriculum.upsert({
      where: {
        courseId_title: {
          courseId: seededCourse.id,
          title: curriculumSeed.title,
        },
      },
      update: {
        description: curriculumSeed.description,
        status: CurriculumStatus.DRAFT,
        createdById: adminUser.id,
      },
      create: {
        courseId: seededCourse.id,
        title: curriculumSeed.title,
        description: curriculumSeed.description,
        status: CurriculumStatus.DRAFT,
        createdById: adminUser.id,
      },
    });

    const moduleRecord = await prisma.curriculumModule.upsert({
      where: {
        curriculumId_title: {
          curriculumId: curriculum.id,
          title: curriculumSeed.moduleTitle,
        },
      },
      update: {
        description: curriculumSeed.moduleDescription,
        sortOrder: 0,
      },
      create: {
        curriculumId: curriculum.id,
        title: curriculumSeed.moduleTitle,
        description: curriculumSeed.moduleDescription,
        sortOrder: 0,
      },
    });

    for (let stageIndex = 0; stageIndex < curriculumSeed.stages.length; stageIndex += 1) {
      const stageSeed = curriculumSeed.stages[stageIndex];

      await prisma.curriculumStage.upsert({
        where: {
          moduleId_title: {
            moduleId: moduleRecord.id,
            title: stageSeed.title,
          },
        },
        update: {
          description: stageSeed.description,
          sortOrder: stageIndex,
        },
        create: {
          moduleId: moduleRecord.id,
          title: stageSeed.title,
          description: stageSeed.description,
          sortOrder: stageIndex,
        },
      });
    }

    seededCurricula.push({
      courseName: curriculumSeed.courseName,
      curriculumId: curriculum.id,
      stageCount: curriculumSeed.stages.length,
    });
  }

  const programRecords = [];
  for (const program of PROGRAMS) {
    const mappedCourse = courseByType.get(program.type);
    if (!mappedCourse) {
      throw new Error(`Missing seeded course for program type ${program.type}.`);
    }

    const programSequence = programRecords.filter((record) => deriveCodePrefix(record.name) === deriveCodePrefix(program.name)).length + 1;

    const record = await prisma.program.upsert({
      where: { slug: program.slug },
      update: {
        courseId: mappedCourse.id,
        code: formatEntityCode("P", program.name, programSequence),
        name: program.name,
        type: program.type,
        category: program.category,
        description: `${program.name} curriculum for academy deployment readiness.`,
        durationWeeks: program.durationWeeks,
        isActive: true,
      },
      create: {
        courseId: mappedCourse.id,
        code: formatEntityCode("P", program.name, programSequence),
        slug: program.slug,
        name: program.name,
        type: program.type,
        category: program.category,
        description: `${program.name} curriculum for academy deployment readiness.`,
        durationWeeks: program.durationWeeks,
        isActive: true,
      },
    });

    programRecords.push(record);
  }

  const trainerRecords = [];
  for (let i = 0; i < TRAINERS.length; i += 1) {
    const profile = TRAINERS[i];
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      password: "dev-password",
    });
    await assignUserRole(user.id, roleRecords.TRAINER.id);

    const assignedCourses = [
      courseByType.get(programRecords[i % programRecords.length].type),
      courseByType.get(programRecords[(i + 3) % programRecords.length].type),
    ].filter(Boolean);
    const employeeCode = await resolveTrainerEmployeeCode({
      userId: user.id,
      sequence: i + 1,
    });

    const trainer = await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      update: {
        employeeCode,
        specialization: profile.specialization,
        bio: `${profile.specialization} trainer focused on measurable outcomes.`,
        rating: profile.rating,
        capacity: 4,
        isActive: true,
        availabilityStatus: TrainerAvailabilityStatus.AVAILABLE,
      },
      create: {
        userId: user.id,
        employeeCode,
        specialization: profile.specialization,
        bio: `${profile.specialization} trainer focused on measurable outcomes.`,
        rating: profile.rating,
        capacity: 4,
        isActive: true,
        availabilityStatus: TrainerAvailabilityStatus.AVAILABLE,
      },
    });

    await prisma.trainerCourseAssignment.deleteMany({
      where: { trainerId: trainer.id },
    });

    if (assignedCourses.length > 0) {
      await prisma.trainerCourseAssignment.createMany({
        data: assignedCourses.map((course) => ({
          trainerId: trainer.id,
          courseId: course.id,
        })),
        skipDuplicates: true,
      });
    }

    trainerRecords.push({
      ...trainer,
      courseIds: assignedCourses.map((course) => course.id),
    });
  }

  const batchRecords = [];
  for (let i = 0; i < programRecords.length; i += 1) {
    const program = programRecords[i];
    const centre = centreRecords[i % centreRecords.length];
    const courseId = courseByType.get(program.type)?.id;
    const eligibleTrainers = trainerRecords.filter((trainer) =>
      Array.isArray(trainer.courseIds) && courseId ? trainer.courseIds.includes(courseId) : false
    );

    const primaryTrainer = eligibleTrainers[0] ?? trainerRecords[i % trainerRecords.length];
    const connectedTrainers = eligibleTrainers.length > 0 ? eligibleTrainers.slice(0, 2) : [primaryTrainer];
    const prefix = program.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
    const code = `B-${prefix}-${String(i + 1).padStart(3, "0")}`;
    const mode = i % 3 === 0 ? BatchMode.ONLINE : BatchMode.OFFLINE;
    const batchCentreId = mode === BatchMode.OFFLINE ? centre.id : null;
    const batchCampus = mode === BatchMode.OFFLINE ? centre.name : null;

    const batch = await prisma.batch.upsert({
      where: { code },
      update: {
        name: `${program.name} Cohort ${i + 1}`,
        programId: program.id,
        centreId: batchCentreId,
        trainerId: primaryTrainer.id,
        trainers: { set: connectedTrainers.map((trainer) => ({ id: trainer.id })) },
        campus: batchCampus,
        startDate: new Date(Date.UTC(2026, i % 6, 1 + (i % 4))),
        endDate: new Date(Date.UTC(2026, (i % 6) + 4, 15)),
        mode,
        status: i % 4 === 0 ? BatchStatus.PLANNED : BatchStatus.IN_SESSION,
        capacity: 25 + (i % 5) * 5,
        schedule: ["MON", "WED", "FRI"],
      },
      create: {
        code,
        name: `${program.name} Cohort ${i + 1}`,
        programId: program.id,
        centreId: batchCentreId,
        trainerId: primaryTrainer.id,
        trainers: { connect: connectedTrainers.map((trainer) => ({ id: trainer.id })) },
        campus: batchCampus,
        startDate: new Date(Date.UTC(2026, i % 6, 1 + (i % 4))),
        endDate: new Date(Date.UTC(2026, (i % 6) + 4, 15)),
        mode,
        status: i % 4 === 0 ? BatchStatus.PLANNED : BatchStatus.IN_SESSION,
        capacity: 25 + (i % 5) * 5,
        schedule: ["MON", "WED", "FRI"],
      },
    });

    batchRecords.push(batch);
  }

  const defaultRule =
    (await prisma.readinessEngineRule.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.readinessEngineRule.create({
      data: {
        name: "default",
        attendanceWeight: 30,
        assessmentWeight: 50,
        softSkillsWeight: 20,
        placementThreshold: 80,
        isDefault: true,
      },
    }));

  const learnerRecords = [];
  for (let i = 0; i < 50; i += 1) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const learnerCode = `GTS-${String(240901 + i)}`;
    const placement = placementForIndex(i);
    const attendance = 70 + (i % 30);
    const assessment = 65 + (i % 30);

    const learner = await prisma.learner.upsert({
      where: { learnerCode },
      update: {
        fullName,
        email: `learner${String(i + 1).padStart(2, "0")}@gts-academy.test`,
        phone: `+91-98${String(70000000 + i).slice(-8)}`,
        country: "India",
        softSkillsScore: 60 + (i % 35),
        readinessPercentage: placement.readiness,
        placementStatus: placement.placementStatus,
        recruiterSyncStatus: placement.syncStatus,
        latestAssessmentAverage: assessment,
        latestAttendancePercentage: attendance,
        isReadyForDeployment: placement.isReadyForDeployment,
      },
      create: {
        learnerCode,
        fullName,
        email: `learner${String(i + 1).padStart(2, "0")}@gts-academy.test`,
        phone: `+91-98${String(70000000 + i).slice(-8)}`,
        country: "India",
        softSkillsScore: 60 + (i % 35),
        readinessPercentage: placement.readiness,
        placementStatus: placement.placementStatus,
        recruiterSyncStatus: placement.syncStatus,
        latestAssessmentAverage: assessment,
        latestAttendancePercentage: attendance,
        isReadyForDeployment: placement.isReadyForDeployment,
      },
    });

    learnerRecords.push(learner);

    const batch = batchRecords[i % batchRecords.length];
    const enrollment = await prisma.batchEnrollment.upsert({
      where: { learnerId_batchId: { learnerId: learner.id, batchId: batch.id } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { learnerId: learner.id, batchId: batch.id, status: EnrollmentStatus.ACTIVE },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_sessionDate: {
          enrollmentId: enrollment.id,
          sessionDate: new Date("2026-03-28"),
        },
      },
      update: {
        status: i % 7 === 0 ? AttendanceStatus.LATE : i % 11 === 0 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
        markedById: adminUser.id,
        notes: "Seeded attendance record",
      },
      create: {
        enrollmentId: enrollment.id,
        sessionDate: new Date("2026-03-28"),
        status: i % 7 === 0 ? AttendanceStatus.LATE : i % 11 === 0 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
        markedById: adminUser.id,
        notes: "Seeded attendance record",
      },
    });

    await prisma.candidateBasicDetails.upsert({
      where: { candidateId: learner.id },
      update: {
        passportNo: `P${String(100000 + i)}`,
        education: { highest: "BSc Nursing" },
        experience: { years: i % 5 },
      },
      create: {
        candidateId: learner.id,
        passportNo: `P${String(100000 + i)}`,
        education: { highest: "BSc Nursing" },
        experience: { years: i % 5 },
      },
    });

    await prisma.candidateDocument.upsert({
      where: { id: makeUuid(11000 + i) },
      update: {
        candidateId: learner.id,
        documentType: "PASSPORT",
        filePath: `/seed-docs/${learnerCode}-passport.pdf`,
        verified: i % 4 !== 0,
      },
      create: {
        id: makeUuid(11000 + i),
        candidateId: learner.id,
        documentType: "PASSPORT",
        filePath: `/seed-docs/${learnerCode}-passport.pdf`,
        verified: i % 4 !== 0,
      },
    });

    await prisma.readinessSnapshot.upsert({
      where: { id: makeUuid(12000 + i) },
      update: {
        learnerId: learner.id,
        ruleId: defaultRule.id,
        percentage: placement.readiness,
        status: placement.placementStatus,
        syncStatus: placement.syncStatus,
        syncedAt: placement.syncStatus === SyncStatus.SYNCED ? new Date("2026-03-29T10:30:00Z") : null,
        notes: "Seeded readiness snapshot",
      },
      create: {
        id: makeUuid(12000 + i),
        learnerId: learner.id,
        ruleId: defaultRule.id,
        percentage: placement.readiness,
        status: placement.placementStatus,
        syncStatus: placement.syncStatus,
        syncedAt: placement.syncStatus === SyncStatus.SYNCED ? new Date("2026-03-29T10:30:00Z") : null,
        notes: "Seeded readiness snapshot",
      },
    });

    if (placement.isReadyForDeployment) {
      await prisma.recruiterSyncLog.upsert({
        where: { id: makeUuid(13000 + i) },
        update: {
          learnerId: learner.id,
          triggeredById: adminUser.id,
          destination: "recruiter-workspace",
          status: placement.syncStatus,
          payload: { learnerCode, readinessPercentage: placement.readiness },
          responseBody: placement.syncStatus === SyncStatus.SYNCED ? { accepted: true } : { accepted: false },
          message: "Seeded recruiter sync log",
        },
        create: {
          id: makeUuid(13000 + i),
          learnerId: learner.id,
          triggeredById: adminUser.id,
          destination: "recruiter-workspace",
          status: placement.syncStatus,
          payload: { learnerCode, readinessPercentage: placement.readiness },
          responseBody: placement.syncStatus === SyncStatus.SYNCED ? { accepted: true } : { accepted: false },
          message: "Seeded recruiter sync log",
        },
      });

      await prisma.certificate.upsert({
        where: { verificationCode: `CERT-${learnerCode}` },
        update: {
          learnerId: learner.id,
          programId: batch.programId,
          status: CertificateStatus.ISSUED,
        },
        create: {
          learnerId: learner.id,
          programId: batch.programId,
          status: CertificateStatus.ISSUED,
          verificationCode: `CERT-${learnerCode}`,
        },
      });
    }

    await prisma.performanceMetric.upsert({
      where: { id: makeUuid(14000 + i) },
      update: {
        learnerId: learner.id,
        batchId: batch.id,
        gameScore: 55 + (i % 35),
        attendancePercentage: attendance,
        readingScore: 60 + (i % 30),
        writingScore: 58 + (i % 35),
        listeningScore: 61 + (i % 28),
        speakingScore: 62 + (i % 27),
        overallBand: (65 + (i % 25)) / 10,
        trainerFeedback: "Seeded performance metric",
      },
      create: {
        id: makeUuid(14000 + i),
        learnerId: learner.id,
        batchId: batch.id,
        gameScore: 55 + (i % 35),
        attendancePercentage: attendance,
        readingScore: 60 + (i % 30),
        writingScore: 58 + (i % 35),
        listeningScore: 61 + (i % 28),
        speakingScore: 62 + (i % 27),
        overallBand: (65 + (i % 25)) / 10,
        trainerFeedback: "Seeded performance metric",
      },
    });

    await prisma.roleplay.upsert({
      where: { id: makeUuid(15000 + i) },
      update: {
        batchId: batch.id,
        learnerId: learner.id,
        trainerId: trainerRecords[i % trainerRecords.length].id,
        scenarioName: "Patient handoff communication",
        videoUrl: `https://seed.local/roleplays/${learnerCode}`,
        scores: { communication: 80, empathy: 78, accuracy: 82 },
      },
      create: {
        id: makeUuid(15000 + i),
        batchId: batch.id,
        learnerId: learner.id,
        trainerId: trainerRecords[i % trainerRecords.length].id,
        scenarioName: "Patient handoff communication",
        videoUrl: `https://seed.local/roleplays/${learnerCode}`,
        scores: { communication: 80, empathy: 78, accuracy: 82 },
      },
    });

    await prisma.interview.upsert({
      where: { id: makeUuid(16000 + i) },
      update: {
        learnerId: learner.id,
        interviewerId: adminUser.id,
        type: i % 2 === 0 ? InterviewType.INTERNAL_MOCK : InterviewType.LANGUAGE_CHECK,
        status: i % 5 === 0 ? EvaluationStatus.COMPLETED : EvaluationStatus.SCHEDULED,
        scheduledAt: new Date(Date.UTC(2026, 4, 1 + (i % 20), 10, 0, 0)),
        feedbackSummary: "Seeded interview record",
        isPassed: i < 5,
      },
      create: {
        id: makeUuid(16000 + i),
        learnerId: learner.id,
        interviewerId: adminUser.id,
        type: i % 2 === 0 ? InterviewType.INTERNAL_MOCK : InterviewType.LANGUAGE_CHECK,
        status: i % 5 === 0 ? EvaluationStatus.COMPLETED : EvaluationStatus.SCHEDULED,
        scheduledAt: new Date(Date.UTC(2026, 4, 1 + (i % 20), 10, 0, 0)),
        feedbackSummary: "Seeded interview record",
        isPassed: i < 5,
      },
    });
  }

  const assessmentRecords = [];
  for (let i = 0; i < batchRecords.length; i += 1) {
    const batch = batchRecords[i];
    const program = programRecords.find((item) => item.id === batch.programId);
    const assessment = await prisma.assessment.upsert({
      where: { id: makeUuid(17000 + i) },
      update: {
        title: `${program?.name ?? "Program"} Assessment ${i + 1}`,
        type: i % 3 === 0 ? AssessmentType.FINAL : AssessmentType.MODULE,
        mode: i % 2 === 0 ? AssessmentMode.ONLINE : AssessmentMode.VIVA_VOCE,
        maxScore: 100,
        programId: batch.programId,
        batchId: batch.id,
        status: EvaluationStatus.COMPLETED,
        scheduledAt: new Date(Date.UTC(2026, 2, 10 + i, 9, 0, 0)),
      },
      create: {
        id: makeUuid(17000 + i),
        title: `${program?.name ?? "Program"} Assessment ${i + 1}`,
        type: i % 3 === 0 ? AssessmentType.FINAL : AssessmentType.MODULE,
        mode: i % 2 === 0 ? AssessmentMode.ONLINE : AssessmentMode.VIVA_VOCE,
        maxScore: 100,
        programId: batch.programId,
        batchId: batch.id,
        status: EvaluationStatus.COMPLETED,
        scheduledAt: new Date(Date.UTC(2026, 2, 10 + i, 9, 0, 0)),
      },
    });

    assessmentRecords.push(assessment);
  }

  for (let i = 0; i < learnerRecords.length; i += 1) {
    const learner = learnerRecords[i];
    const assessment = assessmentRecords[i % assessmentRecords.length];
    const scoreValue = 62 + (i % 35);

    await prisma.assessmentScore.upsert({
      where: { assessmentId_learnerId: { assessmentId: assessment.id, learnerId: learner.id } },
      update: {
        score: scoreValue,
        feedback: "Seeded assessment score",
      },
      create: {
        assessmentId: assessment.id,
        learnerId: learner.id,
        score: scoreValue,
        feedback: "Seeded assessment score",
      },
    });
  }

  for (let i = 0; i < trainerRecords.length; i += 1) {
    const trainer = trainerRecords[i];
    const batch = batchRecords[i % batchRecords.length];

    await prisma.trainerPmsLog.upsert({
      where: { id: makeUuid(18000 + i) },
      update: {
        trainerId: trainer.id,
        batchId: batch.id,
        studentFeedbackAvg: 4.1 + (i % 6) * 0.1,
        completionRate: 82 + i,
        pmsScoreCalculated: 78 + i,
      },
      create: {
        id: makeUuid(18000 + i),
        trainerId: trainer.id,
        batchId: batch.id,
        studentFeedbackAvg: 4.1 + (i % 6) * 0.1,
        completionRate: 82 + i,
        pmsScoreCalculated: 78 + i,
      },
    });
  }

  const readyCount = await prisma.learner.count({ where: { placementStatus: PlacementStatus.PLACEMENT_READY } });

  console.log("Seed complete", {
    roles: Object.keys(roleRecords).length,
    permissions: Object.keys(permissionRecords).length,
    curricula: seededCurricula.length,
    curriculumStagesSeeded: seededCurricula.reduce((total, item) => total + item.stageCount, 0),
    programs: programRecords.length,
    trainers: trainerRecords.length,
    learners: learnerRecords.length,
    placementReadyLearners: readyCount,
    batches: batchRecords.length,
  });
}

seed()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
