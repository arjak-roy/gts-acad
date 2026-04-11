"use client";

import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { CanAccess } from "@/components/ui/can-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableEmptyState } from "@/components/ui/data-table-empty-state";
import { DataTableSearchBar } from "@/components/ui/data-table-search-bar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SortableTableHead, type SortDirection } from "@/components/ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRAINER_AVAILABILITY_LABELS, type TrainerAvailabilityStatus, type TrainerOption, type TrainerRegistryResponse } from "@/services/trainers/types";

type TrainerRegistryStatus = "ALL" | "ACTIVE" | "INACTIVE";
type TrainerRegistryAvailability = "ALL" | TrainerAvailabilityStatus;
type TrainerRegistrySort = "fullName" | "employeeCode" | "email" | "specialization" | "status" | "availabilityStatus" | "lastActiveAt";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type TrainersTableProps = {
  response: TrainerRegistryResponse;
  courseOptions: CourseOption[];
  filters: {
    search: string;
    status: TrainerRegistryStatus;
    availability: TrainerRegistryAvailability;
    specialization: string;
    courseId: string;
    sortBy: TrainerRegistrySort;
    sortDirection: "asc" | "desc";
  };
  onRefresh: () => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function getAvailabilityVariant(availabilityStatus: TrainerAvailabilityStatus) {
  if (availabilityStatus === "AVAILABLE") {
    return "success" as const;
  }

  if (availabilityStatus === "LIMITED") {
    return "warning" as const;
  }

  if (availabilityStatus === "UNAVAILABLE") {
    return "danger" as const;
  }

  return "info" as const;
}

export function TrainersTable({ response, courseOptions, filters, onRefresh }: TrainersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.search);

  const activeSort = filters.sortBy;
  const activeDirection: SortDirection = filters.sortDirection;

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  function updateUrl(patch: Record<string, string | number | undefined | null>) {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  }

  function handleSort(columnKey: string, direction: "asc" | "desc") {
    updateUrl({ sortBy: columnKey, sortDirection: direction, page: 1 });
  }

  async function handleStatusToggle(trainer: TrainerOption) {
    setIsUpdatingId(trainer.id);

    try {
      const nextStatus = trainer.isActive ? "INACTIVE" : "ACTIVE";
      const response = await fetch(`/api/trainers/${trainer.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update trainer status.");
      }

      toast.success(nextStatus === "ACTIVE" ? "Trainer activated successfully." : "Trainer deactivated successfully.");
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update trainer status.";
      toast.error(message);
    } finally {
      setIsUpdatingId(null);
    }
  }

  async function handleArchive(trainer: TrainerOption) {
    const confirmed = window.confirm(`Archive ${trainer.fullName}? This keeps the trainer record but removes active access.`);
    if (!confirmed) {
      return;
    }

    setIsUpdatingId(trainer.id);

    try {
      const response = await fetch(`/api/trainers/${trainer.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to archive trainer.");
      }

      toast.success("Trainer archived successfully.");
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to archive trainer.";
      toast.error(message);
    } finally {
      setIsUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_220px_220px]">
            <DataTableSearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                updateUrl({ search: value, page: 1 });
              }}
              placeholder="Search by name, employee code, email, or specialization..."
            />
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={filters.status}
              onChange={(event) => updateUrl({ status: event.target.value || "ALL", page: 1 })}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={filters.availability}
              onChange={(event) => updateUrl({ availability: event.target.value || "ALL", page: 1 })}
            >
              <option value="ALL">All availability</option>
              {Object.entries(TRAINER_AVAILABILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={filters.specialization}
              onChange={(event) => updateUrl({ specialization: event.target.value, page: 1 })}
            >
              <option value="">All specializations</option>
              {response.filterOptions.specializations.map((specialization) => (
                <option key={specialization} value={specialization}>{specialization}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={filters.courseId}
              onChange={(event) => updateUrl({ courseId: event.target.value, page: 1 })}
            >
              <option value="">All assigned courses</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <SortableTableHead label="Trainer Name" columnKey="fullName" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <SortableTableHead label="Employee ID / Code" columnKey="employeeCode" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <SortableTableHead label="Email" columnKey="email" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <SortableTableHead label="Specialization" columnKey="specialization" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <TableHead>Assigned Courses</TableHead>
                  <SortableTableHead label="Status" columnKey="status" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <SortableTableHead label="Availability" columnKey="availabilityStatus" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <SortableTableHead label="Last Active" columnKey="lastActiveAt" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10">
                      <DataTableEmptyState title="No trainers matched the current filters." description="Try changing the search query or one of the registry filters." />
                    </TableCell>
                  </TableRow>
                ) : (
                  response.items.map((trainer) => (
                    <TableRow key={trainer.id}>
                      <TableCell>
                        <div>
                          <p className="font-bold text-slate-900">{trainer.fullName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">{trainer.employeeCode}</TableCell>
                      <TableCell className="text-sm text-slate-600">{trainer.email}</TableCell>
                      <TableCell>{trainer.specialization}</TableCell>
                      <TableCell>
                        {trainer.courses.length === 0 ? (
                          <span className="text-sm text-slate-500">No courses</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {trainer.courses.slice(0, 2).map((course) => (
                              <Badge key={course} variant="info">{course}</Badge>
                            ))}
                            {trainer.courses.length > 2 ? <Badge variant="default">+{trainer.courses.length - 2}</Badge> : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={trainer.isActive ? "success" : "danger"}>{trainer.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAvailabilityVariant(trainer.availabilityStatus)}>
                          {TRAINER_AVAILABILITY_LABELS[trainer.availabilityStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{formatDate(trainer.lastActiveAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={isUpdatingId === trainer.id}>
                              <MoreHorizontal className="h-5 w-5" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => updateUrl({ id: trainer.id, editId: null, assignCourseId: null, assignQuizId: null })}>View</DropdownMenuItem>
                            <CanAccess permission="trainers.edit">
                              <DropdownMenuItem onSelect={() => updateUrl({ id: null, editId: trainer.id, assignCourseId: null, assignQuizId: null })}>Edit</DropdownMenuItem>
                            </CanAccess>
                            <CanAccess permission="trainers.edit">
                              <DropdownMenuItem onSelect={(event) => {
                                event.preventDefault();
                                void handleStatusToggle(trainer);
                              }}>
                                {trainer.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                            </CanAccess>
                            <CanAccess permission="trainers.edit">
                              <DropdownMenuItem onSelect={() => updateUrl({ id: null, editId: null, assignCourseId: trainer.id, assignQuizId: null })}>Assign Course</DropdownMenuItem>
                            </CanAccess>
                            <CanAccess permission="trainers.manage">
                              <DropdownMenuItem onSelect={() => updateUrl({ id: null, editId: null, assignCourseId: null, assignQuizId: trainer.id })}>Assign Quiz</DropdownMenuItem>
                            </CanAccess>
                            <DropdownMenuSeparator />
                            <CanAccess permission="trainers.delete">
                              <DropdownMenuItem
                                className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                                onSelect={(event) => {
                                  event.preventDefault();
                                  void handleArchive(trainer);
                                }}
                              >
                                Archive
                              </DropdownMenuItem>
                            </CanAccess>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {response.items.length} of {response.totalCount} trainers
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={response.page <= 1} onClick={() => updateUrl({ page: response.page - 1 })}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm font-medium text-slate-600">
                Page {response.page} of {response.pageCount}
              </span>
              <Button variant="secondary" size="sm" disabled={response.page >= response.pageCount} onClick={() => updateUrl({ page: response.page + 1 })}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}