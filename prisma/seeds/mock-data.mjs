// Static mock data constants — courses, programs, trainers, centres, learner names.

import { ProgramType } from "@prisma/client";

export const COURSES = [
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

export const PROGRAMS = [
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

export const CURRICULUM_SEEDS = [
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

export const TRAINERS = [
  { name: "Dr. Markus Stein", email: "markus.trainer@gts-academy.test", phone: "+91-9000000002", specialization: "German Language", rating: 4.8 },
  { name: "Ms. Leena Pillai", email: "leena.trainer@gts-academy.test", phone: "+91-9000000003", specialization: "Clinical Communication", rating: 4.6 },
  { name: "Mr. Rahul Menon", email: "rahul.trainer@gts-academy.test", phone: "+91-9000000004", specialization: "NCLEX Strategy", rating: 4.5 },
  { name: "Dr. Sarah Jacob", email: "sarah.trainer@gts-academy.test", phone: "+91-9000000005", specialization: "OSCE Simulation", rating: 4.7 },
  { name: "Mr. Ajay Thomas", email: "ajay.trainer@gts-academy.test", phone: "+91-9000000006", specialization: "Healthcare IT", rating: 4.4 },
  { name: "Ms. Neha Varma", email: "neha.trainer@gts-academy.test", phone: "+91-9000000007", specialization: "Medical Coding", rating: 4.5 },
  { name: "Mr. Johan Roy", email: "johan.trainer@gts-academy.test", phone: "+91-9000000008", specialization: "Data Quality", rating: 4.3 },
  { name: "Ms. Priya Nair", email: "priya.trainer@gts-academy.test", phone: "+91-9000000009", specialization: "Interview Readiness", rating: 4.6 },
];

export const TRAINING_CENTRES = [
  {
    id: "00000000-0000-0000-0000-000000002329",
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
    id: "00000000-0000-0000-0000-00000000232a",
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
    id: "00000000-0000-0000-0000-00000000232b",
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

export const FIRST_NAMES = [
  "Aditya", "Meera", "Arjun", "Neha", "Rahul", "Priya", "Asha", "Kiran", "Vikram", "Anita",
  "Rohan", "Nisha", "Sandeep", "Divya", "Manoj", "Kavya", "Ravi", "Pooja", "Amit", "Sneha",
  "Varun", "Isha", "Deepak", "Anu", "Harish", "Swathi", "Nitin", "Lakshmi", "Yash", "Maya",
  "Gokul", "Riya", "Suresh", "Anjali", "Tarun", "Shreya", "Karthik", "Minal", "Dev", "Bhavana",
  "Arav", "Keerthi", "Ritesh", "Nandini", "Vivek", "Amritha", "Sai", "Pallavi", "Kunal", "Irene",
];

export const LAST_NAMES = [
  "Sharma", "Nair", "Mehta", "Verma", "Reddy", "Thomas", "Pillai", "Menon", "Roy", "Iyer",
  "Singh", "Patel", "Das", "Mishra", "Khan", "Joshi", "Kapoor", "Bose", "Mathew", "George",
  "Yadav", "Chandra", "Kumar", "Fernandes", "Prasad", "Saxena", "Paul", "Rao", "Bhat", "Pandey",
  "Jain", "Banerjee", "Nanda", "Sethi", "Kulkarni", "Agarwal", "Malhotra", "Dutta", "Srinivasan", "Tripathi",
  "Chopra", "Bhatt", "Shetty", "Ghosh", "Kohli", "Rastogi", "Tiwari", "Lal", "Nambiar", "Raman",
];
