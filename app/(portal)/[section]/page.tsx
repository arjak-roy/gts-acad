import { Suspense } from "react";
import { notFound } from "next/navigation";

import { SectionPageSkeleton } from "@/components/modules/page-skeletons";
import { SectionPageContent } from "@/components/modules/portal/section-page-content";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { listEmailTemplatesService } from "@/services/email-templates-service";
import { PortalSectionContent } from "@/types";

const sectionConfig = {
  courses: {
    title: "Course Library",
    description: "Top-level academic groupings that organize the academy program catalog.",
    accent: "Hierarchy root",
    summary: "Manage course groupings and the programs mapped into each course.",
    metrics: [],
    highlights: [],
    tableTitle: "Courses",
    tableDescription: "Top-level course records.",
    tableColumns: [
      { key: "code", header: "Course Code" },
      { key: "name", header: "Course Name" },
      { key: "courseId", header: "Course ID" },
      { key: "description", header: "Course Desc" },
      { key: "programs", header: "Programs", align: "right" },
    ],
    tableRows: [],
    primaryAction: "Create Course",
    secondaryAction: "View Details",
  },
  programs: {
    title: "Course Catalogue",
    description: "Academy pathways for global nursing and technical roles.",
    accent: "Language + Clinical + Technical",
    summary: "Browse available programs from the academy portfolio.",
    metrics: [],
    highlights: [],
    tableTitle: "Programs",
    tableDescription: "Available academic pathways.",
    tableColumns: [
      { key: "course", header: "Course" },
      { key: "name", header: "Program Name" },
      { key: "type", header: "Type" },
    ],
    tableRows: [],
    primaryAction: "View Details",
    secondaryAction: "Enroll",
  },
  batches: {
    title: "Batch Operations",
    description: "Monitoring live cohorts, trainer assignments, and intake capacity.",
    accent: "2 active sessions",
    summary: "Current active batches and deployment details.",
    metrics: [],
    highlights: [],
    tableTitle: "Active Batches",
    tableDescription: "Live cohort sessions.",
    tableColumns: [
      { key: "code", header: "Batch Code" },
      { key: "status", header: "Status" },
    ],
    tableRows: [],
    primaryAction: "Manage Batch",
    secondaryAction: "View Details",
  },
  trainers: {
    title: "Trainer Registry",
    description: "Managing faculty specialization, utilization, and quality signals.",
    accent: "Faculty utilization",
    summary: "Registered trainers and instructor profiles.",
    metrics: [],
    highlights: [],
    tableTitle: "Trainers",
    tableDescription: "Faculty members and specialists.",
    tableColumns: [
      { key: "name", header: "Trainer Name" },
      { key: "specialization", header: "Specialization" },
    ],
    tableRows: [],
    primaryAction: "Assign Batch",
    secondaryAction: "Edit Profile",
  },
  attendance: {
    title: "Attendance Logs",
    description: "Tracking daily engagement and operational attendance risks.",
    accent: "Bulk actions enabled",
    summary: "Attendance tracking and engagement records.",
    metrics: [],
    highlights: [],
    tableTitle: "Recent Records",
    tableDescription: "Attendance log entries.",
    tableColumns: [
      { key: "learner", header: "Learner" },
      { key: "status", header: "Status" },
    ],
    tableRows: [],
    primaryAction: "Mark Attendance",
    secondaryAction: "View History",
  },
  assessments: {
    title: "Assessment Bank",
    description: "Managing diagnostic tests, module rubrics, and final evaluations.",
    accent: "Assessment orchestration",
    summary: "Test instruments and evaluation criteria.",
    metrics: [],
    highlights: [],
    tableTitle: "Assessments",
    tableDescription: "Available evaluation tools.",
    tableColumns: [
      { key: "name", header: "Assessment Name" },
      { key: "type", header: "Type" },
    ],
    tableRows: [],
    primaryAction: "Configure",
    secondaryAction: "Review Results",
  },
  certifications: {
    title: "Certifications",
    description: "Issuing verified program milestones and certificate records.",
    accent: "Digital verification",
    summary: "Program completion certificates and credentials.",
    metrics: [],
    highlights: [],
    tableTitle: "Issued Certificates",
    tableDescription: "Certificate records.",
    tableColumns: [
      { key: "learner", header: "Learner" },
      { key: "program", header: "Program" },
    ],
    tableRows: [],
    primaryAction: "Issue Certificate",
    secondaryAction: "View Archive",
  },
  readiness: {
    title: "Placement Readiness",
    description: "Vetting candidates before handoff into recruiter-facing systems.",
    accent: "Recruiter pipeline sync",
    summary: "Candidate readiness assessment and placement pipeline.",
    metrics: [],
    highlights: [],
    tableTitle: "Readiness Queue",
    tableDescription: "Candidates under review.",
    tableColumns: [
      { key: "learner", header: "Learner" },
      { key: "status", header: "Status" },
    ],
    tableRows: [],
    primaryAction: "Review Candidate",
    secondaryAction: "Sync to Recruiter",
  },
  "language-lab": {
    title: "Language Lab Admin",
    description: "Managing speaking prep workflows, topic libraries, and fluency scoring.",
    accent: "CEFR-aligned scoring",
    summary: "Language practice sessions and fluency tracking.",
    metrics: [],
    highlights: [],
    tableTitle: "Speaking Sessions",
    tableDescription: "Language lab activities.",
    tableColumns: [
      { key: "learner", header: "Learner" },
      { key: "level", header: "CEFR Level" },
    ],
    tableRows: [],
    primaryAction: "Schedule Session",
    secondaryAction: "View Results",
  },
  payments: {
    title: "Academy Payments",
    description: "Tracking fee plans, collections, and finance synchronization.",
    accent: "Finance-ready ledger",
    summary: "Payment processing and financial records.",
    metrics: [],
    highlights: [],
    tableTitle: "Transactions",
    tableDescription: "Payment records.",
    tableColumns: [
      { key: "learner", header: "Learner" },
      { key: "amount", header: "Amount" },
    ],
    tableRows: [],
    primaryAction: "Process Payment",
    secondaryAction: "View Statement",
  },
  support: {
    title: "Support Queue",
    description: "Managing learner queries, SLA coverage, and escalations.",
    accent: "Operations support",
    summary: "Learner support tickets and request management.",
    metrics: [],
    highlights: [],
    tableTitle: "Open Tickets",
    tableDescription: "Support requests.",
    tableColumns: [
      { key: "id", header: "Ticket ID" },
      { key: "status", header: "Status" },
    ],
    tableRows: [],
    primaryAction: "Create Ticket",
    secondaryAction: "View History",
  },
  settings: {
    title: "System Configuration",
    description: "Manage the HTML email templates used by sign-in and other platform notifications.",
    accent: "Template controls",
    summary: "System-owned and custom mail templates stored in the database.",
    metrics: [],
    highlights: [],
    tableTitle: "Email Templates",
    tableDescription: "Create and edit reusable HTML templates for operational email flows.",
    tableColumns: [
      { key: "name", header: "Template" },
      { key: "key", header: "Key" },
      { key: "subject", header: "Subject" },
      { key: "variables", header: "Variables" },
      { key: "updated", header: "Updated" },
      { key: "status", header: "Status" },
    ],
    tableRows: [],
    primaryAction: "Create Template",
    secondaryAction: "View Usage",
  },
};

type SectionPageProps = {
  params: {
    section: keyof typeof sectionConfig;
  };
};

type SectionKey = keyof typeof sectionConfig;

async function resolveSectionContent(section: SectionKey): Promise<PortalSectionContent> {
  const base = sectionConfig[section] as PortalSectionContent;

  if (section === "settings") {
    const templates = await listEmailTemplatesService();
    const activeTemplates = templates.filter((template) => template.isActive).length;
    const systemTemplates = templates.filter((template) => template.isSystem).length;

    return {
      ...base,
      accent: `${activeTemplates} active templates`,
      metrics: [
        { label: "Total Templates", value: String(templates.length), helper: "Rows currently available in the email template library" },
        { label: "System Templates", value: String(systemTemplates), helper: "Reserved keys used by core product flows" },
        { label: "Active", value: String(activeTemplates), helper: "Templates eligible for runtime delivery" },
      ],
      highlights: [
        {
          label: "Variable Coverage",
          value: `${templates.filter((template) => template.variables.length > 0).length} templates include runtime placeholders`,
          tone: "info",
        },
      ],
      tableRows: templates.map((template) => ({
        id: template.id,
        name: template.name,
        key: template.key,
        subject: template.subject.length > 48 ? `${template.subject.slice(0, 45)}...` : template.subject,
        variables: template.variables.length > 0 ? template.variables.join(", ") : "None",
        updated: new Date(template.updatedAt).toLocaleDateString("en-IN"),
        status: template.isActive ? "ACTIVE" : "INACTIVE",
      })),
    };
  }

  if (!isDatabaseConfigured) {
    return base;
  }

  try {
    if (section === "courses") {
      const courses = await prisma.course.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
          _count: {
            select: {
              programs: true,
            },
          },
        },
      });

      const activeCourses = courses.filter((course) => course.isActive).length;
      const totalPrograms = courses.reduce((sum, course) => sum + course._count.programs, 0);

      return {
        ...base,
        accent: `${activeCourses} active courses`,
        metrics: [
          { label: "Total Courses", value: String(courses.length), helper: "Top-level hierarchy entities" },
          { label: "Active", value: String(activeCourses), helper: "Currently available for mapping" },
          { label: "Programs Mapped", value: String(totalPrograms), helper: "Programs linked across all courses" },
        ],
        highlights: [
          {
            label: "Catalog Health",
            value: `${courses.filter((course) => course._count.programs === 0).length} courses currently without programs`,
            tone: "info",
          },
        ],
        tableRows: courses.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          courseId: course.id,
          description: course.description ?? "No description",
          programs: String(course._count.programs),
        })),
      };
    }

    if (section === "programs") {
      const programs = await prisma.program.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          course: { select: { name: true } },
          name: true,
          type: true,
          durationWeeks: true,
          isActive: true,
          _count: {
            select: {
              batches: true,
            },
          },
        },
      });

      const activePrograms = programs.filter((program) => program.isActive).length;
      const totalBatches = programs.reduce((total, program) => total + program._count.batches, 0);

      return {
        ...base,
        accent: `${activePrograms} active programs`,
        metrics: [
          { label: "Total Programs", value: String(programs.length), helper: "Mapped from courses table" },
          { label: "Active", value: String(activePrograms), helper: "Currently open for enrollment" },
          { label: "Batch Links", value: String(totalBatches), helper: "Program-to-batch assignments" },
        ],
        highlights: [
          {
            label: "Catalog Coverage",
            value: `Program types in use: ${Array.from(new Set(programs.map((program) => program.type))).join(", ") || "N/A"}`,
            tone: "info",
          },
        ],
        tableColumns: [
          { key: "course", header: "Course" },
          { key: "program", header: "Program" },
          { key: "type", header: "Type" },
          { key: "duration", header: "Duration" },
          { key: "status", header: "Status" },
          { key: "batches", header: "Batches", align: "right" },
        ],
        tableRows: programs.map((program) => ({
          id: program.id,
          course: program.course.name,
          program: program.name,
          type: program.type,
          duration: `${program.durationWeeks} weeks`,
          status: program.isActive ? "ACTIVE" : "INACTIVE",
          batches: String(program._count.batches),
        })),
      };
    }

    if (section === "batches") {
      const batches = await prisma.batch.findMany({
        orderBy: { startDate: "desc" },
        take: 20,
        include: {
          program: { select: { name: true } },
          trainer: {
            include: {
              user: { select: { name: true } },
            },
          },
          trainers: {
            include: {
              user: { select: { name: true } },
            },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      });

      const liveBatches = batches.filter((batch) => batch.status === "IN_SESSION").length;
      const avgFillRate =
        batches.length > 0
          ? Math.round(
              batches.reduce((sum, batch) => sum + (batch.capacity > 0 ? (batch._count.enrollments / batch.capacity) * 100 : 0), 0) / batches.length,
            )
          : 0;

      return {
        ...base,
        accent: `${liveBatches} in session`,
        metrics: [
          { label: "Total Batches", value: String(batches.length), helper: "Recent operational cohorts" },
          { label: "Live", value: String(liveBatches), helper: "Status: IN_SESSION" },
          { label: "Avg Fill Rate", value: `${avgFillRate}%`, helper: "Enrollment vs capacity" },
        ],
        highlights: [
          {
            label: "Last Batch Started",
            value: batches[0] ? new Date(batches[0].startDate).toLocaleDateString("en-IN") : "No batches available",
            tone: "default",
          },
        ],
        tableColumns: [
          { key: "code", header: "Code" },
          { key: "program", header: "Program" },
          { key: "trainer", header: "Trainer" },
          { key: "status", header: "Status" },
          { key: "learners", header: "Learners", align: "right" },
        ],
        tableRows: batches.map((batch) => ({
          id: batch.id,
          code: batch.code,
          program: batch.program.name,
          trainer:
            batch.trainers.length > 0
              ? Array.from(new Set(batch.trainers.map((trainer) => trainer.user.name))).join(", ")
              : batch.trainer?.user.name ?? "Unassigned",
          status: batch.status,
          learners: `${batch._count.enrollments}/${batch.capacity}`,
        })),
      };
    }

    if (section === "trainers") {
      const trainers = await prisma.trainerProfile.findMany({
        orderBy: { joinedAt: "desc" },
        take: 20,
        include: {
          user: { select: { name: true } },
          batches: {
            where: { status: "IN_SESSION" },
            select: { id: true },
          },
        },
      });

      const activeTrainers = trainers.filter((trainer) => trainer.isActive).length;
      const avgRating =
        trainers.length > 0 ? (trainers.reduce((sum, trainer) => sum + Number(trainer.rating), 0) / trainers.length).toFixed(2) : "0.00";
      const inSessionAssignments = trainers.reduce((sum, trainer) => sum + trainer.batches.length, 0);

      return {
        ...base,
        accent: `${activeTrainers} active trainers`,
        metrics: [
          { label: "Trainer Profiles", value: String(trainers.length), helper: "From trainers table" },
          { label: "Active", value: String(activeTrainers), helper: "Marked active" },
          { label: "Average Rating", value: avgRating, helper: "Aggregate quality score" },
        ],
        highlights: [
          {
            label: "Live Assignments",
            value: `${inSessionAssignments} in-session trainer assignments`,
            tone: "accent",
          },
        ],
        tableColumns: [
          { key: "trainer", header: "Trainer" },
          { key: "specialization", header: "Specialization" },
          { key: "rating", header: "Rating", align: "right" },
          { key: "status", header: "Status" },
          { key: "batches", header: "Live Batches", align: "right" },
        ],
        tableRows: trainers.map((trainer) => ({
          id: trainer.id,
          trainer: trainer.user.name,
          specialization: trainer.specialization,
          rating: Number(trainer.rating).toFixed(2),
          status: trainer.isActive ? "ACTIVE" : "INACTIVE",
          batches: String(trainer.batches.length),
        })),
      };
    }

    return base;
  } catch (error) {
    console.warn(`Portal section fallback activated for ${section}`, error);
    return base;
  }
}

export default function SectionPage({ params }: SectionPageProps) {
  return (
    <Suspense fallback={<SectionPageSkeleton />}>
      <SectionPageContentLoader params={params} />
    </Suspense>
  );
}

async function SectionPageContentLoader({ params }: SectionPageProps) {
  const section = await resolveSectionContent(params.section);

  if (!section) {
    notFound();
  }

  return <SectionPageContent section={section} sectionKey={params.section} />;
}