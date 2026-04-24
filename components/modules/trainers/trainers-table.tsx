"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { CanAccess } from "@/components/ui/can-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableEmptyState } from "@/components/ui/data-table-empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableSearchBar } from "@/components/ui/data-table-search-bar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SortableTableHead, type SortDirection } from "@/components/ui/sortable-table-head";
import { TableColumnVisibilityMenu } from "@/components/ui/table-column-visibility-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePersistedTablePreferences } from "@/hooks/use-persisted-table-preferences";
import { TRAINER_AVAILABILITY_LABELS, type TrainerAvailabilityStatus, type TrainerOption, type TrainerRegistryResponse } from "@/services/trainers/types";

import type { TrainerStatus } from "@/services/trainers/types";

type TrainerRegistryStatus = "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
type TrainerRegistryAvailability = "ALL" | TrainerAvailabilityStatus;
type TrainerRegistrySort = "fullName" | "employeeCode" | "email" | "specialization" | "department" | "status" | "availabilityStatus" | "lastActiveAt";

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
    department: string;
    courseId: string;
    sortBy: TrainerRegistrySort;
    sortDirection: "asc" | "desc";
  };
  onRefresh: () => void;
};

const TRAINERS_TABLE_KEY = "portal:trainers";
const TRAINERS_TABLE_PAGE_SIZES = [10, 25, 50, 100];
const TRAINER_COLUMN_OPTIONS = [
  { key: "fullName", label: "Trainer Name" },
  { key: "employeeCode", label: "Employee ID / Code" },
  { key: "email", label: "Email" },
  { key: "specialization", label: "Specialization" },
  { key: "department", label: "Department" },
  { key: "courses", label: "Assigned Courses" },
  { key: "status", label: "Status" },
  { key: "availability", label: "Availability" },
  { key: "lastUpdatedAt", label: "Last Updated" },
];

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

export function TrainersTable({ response, courseOptions, filters, onRefresh }: TrainersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.search);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{ trainer: TrainerOption; targetStatus: TrainerStatus; reason: string } | null>(null);
  const [isStatusModalSubmitting, setIsStatusModalSubmitting] = useState(false);
  const {
    preferences,
    hasLoadedPreferences,
    visibleColumnIds,
    setPageSize,
    toggleColumnVisibility,
    resetPreferences,
  } = usePersistedTablePreferences({
    tableKey: TRAINERS_TABLE_KEY,
    defaultPageSize: response.pageSize,
    pageSizes: TRAINERS_TABLE_PAGE_SIZES,
    columnIds: TRAINER_COLUMN_OPTIONS.map((column) => column.key),
  });

  const activeSort = filters.sortBy;
  const activeDirection: SortDirection = filters.sortDirection;

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  const updateUrl = useCallback((patch: Record<string, string | number | undefined | null>) => {
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
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!hasLoadedPreferences || searchParams.has("pageSize") || preferences.pageSize === response.pageSize) {
      return;
    }

    updateUrl({ pageSize: preferences.pageSize, page: 1 });
  }, [hasLoadedPreferences, preferences.pageSize, response.pageSize, searchParams, updateUrl]);

  function handleSort(columnKey: string, direction: "asc" | "desc") {
    updateUrl({ sortBy: columnKey, sortDirection: direction, page: 1 });
  }

  function openStatusModal(trainer: TrainerOption, targetStatus: TrainerStatus) {
    setStatusChangeTarget({ trainer, targetStatus, reason: "" });
  }

  async function handleStatusChangeConfirm() {
    if (!statusChangeTarget) {
      return;
    }

    setIsStatusModalSubmitting(true);
    setIsUpdatingId(statusChangeTarget.trainer.id);

    try {
      const response = await fetch(`/api/trainers/${statusChangeTarget.trainer.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusChangeTarget.targetStatus, reason: statusChangeTarget.reason }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update trainer status.");
      }

      const statusLabels: Record<TrainerStatus, string> = { ACTIVE: "activated", INACTIVE: "deactivated", SUSPENDED: "suspended" };
      toast.success(`Trainer ${statusLabels[statusChangeTarget.targetStatus]} successfully.`);
      setStatusChangeTarget(null);
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update trainer status.";
      toast.error(message);
    } finally {
      setIsUpdatingId(null);
      setIsStatusModalSubmitting(false);
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_180px_200px_200px]">
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
              <option value="SUSPENDED">Suspended</option>
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
                value={filters.department}
                onChange={(event) => updateUrl({ department: event.target.value, page: 1 })}
              >
                <option value="">All departments</option>
                {(response.filterOptions.departments ?? []).map((department) => (
                  <option key={department} value={department}>{department}</option>
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

          <div className="flex justify-end">
            <TableColumnVisibilityMenu
              columns={TRAINER_COLUMN_OPTIONS.map((column) => ({
                key: column.key,
                label: column.label,
                checked: !preferences.hiddenColumnIds.includes(column.key),
                disabled:
                  !preferences.hiddenColumnIds.includes(column.key) && visibleColumnIds.length === 1,
              }))}
              onToggle={toggleColumnVisibility}
              onReset={resetPreferences}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <Table className="min-w-[1320px]">
              <TableHeader className="sticky-admin-table-header">
                <TableRow>
                  {!preferences.hiddenColumnIds.includes("fullName") ? <SortableTableHead label="Trainer Name" columnKey="fullName" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("employeeCode") ? <SortableTableHead label="Employee ID / Code" columnKey="employeeCode" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("email") ? <SortableTableHead label="Email" columnKey="email" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("specialization") ? <SortableTableHead label="Specialization" columnKey="specialization" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("department") ? <SortableTableHead label="Department" columnKey="department" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("courses") ? <TableHead>Assigned Courses</TableHead> : null}
                  {!preferences.hiddenColumnIds.includes("status") ? <SortableTableHead label="Status" columnKey="status" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("availability") ? <SortableTableHead label="Availability" columnKey="availabilityStatus" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("lastUpdatedAt") ? <SortableTableHead label="Last Updated" columnKey="lastActiveAt" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnIds.length + 1} className="py-10">
                      <DataTableEmptyState title="No trainers matched the current filters." description="Try changing the search query or one of the registry filters." />
                    </TableCell>
                  </TableRow>
                ) : (
                  response.items.map((trainer) => (
                    <TableRow key={trainer.id}>
                      {!preferences.hiddenColumnIds.includes("fullName") ? (
                        <TableCell>
                          <div>
                            <p className="font-bold text-slate-900">{trainer.fullName}</p>
                          </div>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("employeeCode") ? (
                        <TableCell className="font-medium text-slate-700">{trainer.employeeCode}</TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("email") ? (
                        <TableCell className="text-sm text-slate-600">{trainer.email}</TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("specialization") ? <TableCell>{trainer.specialization}</TableCell> : null}
                      {!preferences.hiddenColumnIds.includes("department") ? (
                        <TableCell className="text-sm text-slate-600">{trainer.department ?? <span className="text-slate-400">—</span>}</TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("courses") ? (
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
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("status") ? (
                        <TableCell>
                          <Badge
                            variant={trainer.trainerStatus === "ACTIVE" ? "success" : trainer.trainerStatus === "SUSPENDED" ? "warning" : "danger"}
                          >
                            {trainer.trainerStatus === "ACTIVE" ? "Active" : trainer.trainerStatus === "SUSPENDED" ? "Suspended" : "Inactive"}
                          </Badge>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("availability") ? (
                        <TableCell>
                          <Badge variant={trainer.availabilityStatus === "AVAILABLE" ? "success" : trainer.availabilityStatus === "LIMITED" ? "warning" : trainer.availabilityStatus === "UNAVAILABLE" ? "danger" : "info"}>
                            {TRAINER_AVAILABILITY_LABELS[trainer.availabilityStatus]}
                          </Badge>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("lastUpdatedAt") ? (
                        <TableCell className="text-sm text-slate-600">{formatDate(trainer.lastUpdatedAt)}</TableCell>
                      ) : null}
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
                            <CanAccess permission="trainers.status.manage">
                              {trainer.trainerStatus !== "ACTIVE" ? (
                                <DropdownMenuItem onSelect={() => openStatusModal(trainer, "ACTIVE")}>Activate</DropdownMenuItem>
                              ) : null}
                              {trainer.trainerStatus !== "INACTIVE" ? (
                                <DropdownMenuItem onSelect={() => openStatusModal(trainer, "INACTIVE")}>Deactivate</DropdownMenuItem>
                              ) : null}
                              {trainer.trainerStatus !== "SUSPENDED" ? (
                                <DropdownMenuItem className="text-amber-700 focus:bg-amber-50 focus:text-amber-800" onSelect={() => openStatusModal(trainer, "SUSPENDED")}>Suspend</DropdownMenuItem>
                              ) : null}
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

          <DataTablePagination
            currentPage={response.page - 1}
            pageCount={response.pageCount}
            totalRows={response.totalCount}
            visibleRows={response.items.length}
            pageSize={response.pageSize}
            pageSizes={TRAINERS_TABLE_PAGE_SIZES}
            onPageChange={(page) => updateUrl({ page: page + 1 })}
            onPageSizeChange={(size) => {
              setPageSize(size);
              updateUrl({ pageSize: size, page: 1 });
            }}
          />
        </CardContent>
      </Card>

      {statusChangeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Change Trainer Status</h2>
            <p className="mt-1 text-sm text-slate-600">
              Change status of <span className="font-semibold">{statusChangeTarget.trainer.fullName}</span> from{" "}
              <span className="font-semibold">{statusChangeTarget.trainer.trainerStatus}</span> to{" "}
              <span className="font-semibold">{statusChangeTarget.targetStatus}</span>.
            </p>

            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reason (optional)</label>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                placeholder="Add a reason for this status change..."
                value={statusChangeTarget.reason}
                onChange={(event) => setStatusChangeTarget((prev) => prev ? { ...prev, reason: event.target.value } : null)}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={isStatusModalSubmitting} onClick={() => setStatusChangeTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isStatusModalSubmitting}
                onClick={() => void handleStatusChangeConfirm()}
              >
                {isStatusModalSubmitting ? "Updating..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}