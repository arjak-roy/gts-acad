"use client";

import { useEffect, useState } from "react";
import { BookOpen, UserCheck, UserCog, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AddTrainerSheet } from "@/components/modules/trainers/add-trainer-sheet";
import { AssignTrainerAssessmentsSheet } from "@/components/modules/trainers/assign-trainer-assessments-sheet";
import { AssignTrainerCoursesSheet } from "@/components/modules/trainers/assign-trainer-courses-sheet";
import { EditTrainerSheet } from "@/components/modules/trainers/edit-trainer-sheet";
import { TrainerDetailSheet } from "@/components/modules/trainers/trainer-detail-sheet";
import { TrainerBulkImportCard } from "@/components/modules/trainers/trainer-bulk-import-card";
import { TrainersTable } from "@/components/modules/trainers/trainers-table";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrainerRegistryResponse } from "@/services/trainers/types";

const EMPTY_RESPONSE: TrainerRegistryResponse = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
  pageCount: 1,
  filterOptions: {
    specializations: [],
    departments: [],
  },
};

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function TrainersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [response, setResponse] = useState<TrainerRegistryResponse>(EMPTY_RESPONSE);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const searchParamsKey = searchParams.toString();

  const selectedTrainerId = searchParams.get("id");
  const editingTrainerId = searchParams.get("editId");
  const assigningCourseTrainerId = searchParams.get("assignCourseId");
  const assigningQuizTrainerId = searchParams.get("assignQuizId");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") as "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | null) ?? "ALL";
  const availability = (searchParams.get("availability") as "ALL" | "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "ON_LEAVE" | null) ?? "ALL";
  const specialization = searchParams.get("specialization") ?? "";
  const department = searchParams.get("department") ?? "";
  const courseId = searchParams.get("courseId") ?? "";
  const sortBy = (searchParams.get("sortBy") as "fullName" | "employeeCode" | "email" | "specialization" | "department" | "status" | "availabilityStatus" | "lastActiveAt" | null) ?? "fullName";
  const sortDirection = (searchParams.get("sortDirection") as "asc" | "desc" | null) ?? "asc";

  useEffect(() => {
    let cancelled = false;

    async function loadTrainers() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(searchParamsKey);
        params.delete("id");
        params.delete("editId");
        params.delete("assignCourseId");
        params.delete("assignQuizId");

        const [registryResponse, coursesResponse] = await Promise.all([
          fetch(`/api/trainers/registry?${params.toString()}`, { cache: "no-store" }),
          fetch("/api/courses", { cache: "no-store" }),
        ]);

        const registryPayload = (await registryResponse.json().catch(() => null)) as { data?: TrainerRegistryResponse; error?: string } | null;
        const coursesPayload = (await coursesResponse.json().catch(() => null)) as { data?: CourseOption[]; error?: string } | null;

        if (!registryResponse.ok) {
          throw new Error(registryPayload?.error || "Unable to load trainers.");
        }

        if (!coursesResponse.ok) {
          throw new Error(coursesPayload?.error || "Unable to load courses.");
        }

        if (!cancelled) {
          setResponse(registryPayload?.data ?? EMPTY_RESPONSE);
          setCourses((coursesPayload?.data ?? []).filter((course) => course.isActive));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load trainers.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTrainers();

    return () => {
      cancelled = true;
    };
  }, [refreshNonce, searchParamsKey]);

  function refreshTrainers() {
    setRefreshNonce((current) => current + 1);
  }

  function clearOverlayParams() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    params.delete("editId");
    params.delete("assignCourseId");
    params.delete("assignQuizId");
    router.replace(params.size > 0 ? `/trainers?${params.toString()}` : "/trainers", { scroll: false });
  }

  function openEditTrainer(trainerId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    params.delete("assignCourseId");
    params.delete("assignQuizId");
    params.set("editId", trainerId);
    router.replace(`/trainers?${params.toString()}`, { scroll: false });
  }

  const activeOnPage = response.items.filter((trainer) => trainer.isActive).length;
  const availableOnPage = response.items.filter((trainer) => trainer.availabilityStatus === "AVAILABLE").length;
  const assignedCoursesOnPage = new Set(response.items.flatMap((trainer) => trainer.courses)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Trainer Registry</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Manage trainer records, course assignments, availability, and operational status from one registry.
          </p>
        </div>
        <CanAccess permission="trainers.create">
          <AddTrainerSheet onCreated={refreshTrainers} />
        </CanAccess>
      </div>

      <TrainerBulkImportCard onImported={refreshTrainers} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Matching Trainers</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : response.totalCount}</div>
            <p className="text-xs text-slate-500">Current search and filter result set</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active On Page</CardTitle>
            <UserCheck className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : activeOnPage}</div>
            <p className="text-xs text-slate-500">Visible trainers with active portal access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Available On Page</CardTitle>
            <UserCog className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : availableOnPage}</div>
            <p className="text-xs text-slate-500">Visible trainers marked available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Courses Represented</CardTitle>
            <BookOpen className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : assignedCoursesOnPage}</div>
            <p className="text-xs text-slate-500">Distinct assigned courses on the visible page</p>
          </CardContent>
        </Card>
      </div>

      {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600">{error}</div> : null}

      {isLoading ? (
        <TrainersPageSkeleton />
      ) : (
        <TrainersTable
          response={response}
          courseOptions={courses}
          filters={{ search, status, availability, specialization, department, courseId, sortBy, sortDirection }}
          onRefresh={refreshTrainers}
        />
      )}

      <TrainerDetailSheet
        trainerId={selectedTrainerId}
        open={Boolean(selectedTrainerId)}
        onOpenChange={(open) => !open && clearOverlayParams()}
        onEdit={openEditTrainer}
      />

      <EditTrainerSheet
        trainerId={editingTrainerId}
        open={Boolean(editingTrainerId)}
        onOpenChange={(open) => !open && clearOverlayParams()}
        onUpdated={refreshTrainers}
        onArchived={refreshTrainers}
      />

      <AssignTrainerCoursesSheet
        trainerId={assigningCourseTrainerId}
        open={Boolean(assigningCourseTrainerId)}
        onOpenChange={(open) => !open && clearOverlayParams()}
        onUpdated={refreshTrainers}
      />

      <AssignTrainerAssessmentsSheet
        trainerId={assigningQuizTrainerId}
        open={Boolean(assigningQuizTrainerId)}
        onOpenChange={(open) => !open && clearOverlayParams()}
        onUpdated={refreshTrainers}
      />
    </div>
  );
}

function TrainersPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}