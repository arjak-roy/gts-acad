"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type LogsModule = "email" | "batch" | "candidate" | "course" | "program";

type EmailStatus = "ALL" | "PENDING" | "SENT" | "FAILED" | "RETRYING";
type EmailCategory = "ALL" | "CANDIDATE_WELCOME" | "TWO_FACTOR" | "SYSTEM";
type AuditLevel = "ALL" | "INFO" | "WARN" | "ERROR";
type AuditAction = "ALL" | "CREATED" | "UPDATED" | "ENROLLED" | "MAIL_SENT" | "MAIL_FAILED" | "MAIL_RETRIED" | "LOGIN" | "TWO_FACTOR" | "RETRY";

type EmailLogItem = {
  id: string;
  category: "CANDIDATE_WELCOME" | "TWO_FACTOR" | "SYSTEM";
  templateKey: string | null;
  toEmail: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED" | "RETRYING";
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
};

type EmailLogsResponse = {
  items: EmailLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type AuditLogItem = {
  id: string;
  entityType: "BATCH" | "CANDIDATE" | "COURSE" | "EMAIL" | "AUTH" | "SYSTEM";
  entityId: string | null;
  action: string;
  level: "INFO" | "WARN" | "ERROR";
  status: string | null;
  message: string;
  createdAt: string;
};

type AuditLogsResponse = {
  items: AuditLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type LogsActionsSectionProps = {
  title: string;
  description: string;
};

const MODULE_CONFIG: Array<{ key: LogsModule; label: string }> = [
  { key: "email", label: "Email Logs" },
  { key: "batch", label: "Batch Logs" },
  { key: "candidate", label: "Candidate Logs" },
  { key: "course", label: "Course Logs" },
  { key: "program", label: "Program Logs" },
];

function resolveAuditScope(module: LogsModule): { entityType: "BATCH" | "CANDIDATE" | "COURSE" | "SYSTEM"; status?: string } {
  if (module === "batch") {
    return { entityType: "BATCH" };
  }

  if (module === "candidate") {
    return { entityType: "CANDIDATE" };
  }

  if (module === "course") {
    return { entityType: "COURSE" };
  }

  if (module === "program") {
    return { entityType: "SYSTEM", status: "PROGRAM" };
  }

  return { entityType: "SYSTEM" };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusBadgeVariant(status: string) {
  if (status === "SENT" || status === "INFO") {
    return "success" as const;
  }

  if (status === "FAILED" || status === "ERROR") {
    return "danger" as const;
  }

  if (status === "RETRYING" || status === "WARN") {
    return "warning" as const;
  }

  return "default" as const;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { data?: T; error?: string };

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload.data;
}

export function LogsActionsSection({ title, description }: LogsActionsSectionProps) {
  const [activeModule, setActiveModule] = useState<LogsModule>("email");
  const [search, setSearch] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("ALL");
  const [emailCategory, setEmailCategory] = useState<EmailCategory>("ALL");
  const [auditLevel, setAuditLevel] = useState<AuditLevel>("ALL");
  const [auditAction, setAuditAction] = useState<AuditAction>("ALL");
  const [auditStatus, setAuditStatus] = useState("");
  const [auditEntityId, setAuditEntityId] = useState("");
  const [emailPage, setEmailPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [emailData, setEmailData] = useState<EmailLogsResponse | null>(null);
  const [auditData, setAuditData] = useState<AuditLogsResponse | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const retryableVisibleEmailIds = useMemo(
    () => (emailData?.items ?? []).filter((item) => item.status === "FAILED").map((item) => item.id),
    [emailData],
  );

  const allVisibleRetryableSelected = retryableVisibleEmailIds.length > 0 && retryableVisibleEmailIds.every((id) => selectedEmailIds.includes(id));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeModule === "email") {
        const params = new URLSearchParams({
          page: String(emailPage),
          pageSize: "10",
          status: emailStatus,
          category: emailCategory,
          search,
        });

        const response = await fetch(`/api/logs-actions/email?${params.toString()}`, { cache: "no-store" });
        const data = await parseResponse<EmailLogsResponse>(response);
        setEmailData(data);
      } else {
        const scope = resolveAuditScope(activeModule);
        const statusFilter = auditStatus.trim() || scope.status;
        const entityIdFilter = auditEntityId.trim();
        const params = new URLSearchParams({
          page: String(auditPage),
          pageSize: "10",
          entityType: scope.entityType,
          level: auditLevel,
          action: auditAction,
          search,
        });

        if (statusFilter) {
          params.set("status", statusFilter);
        }

        if (entityIdFilter) {
          params.set("entityId", entityIdFilter);
        }

        const response = await fetch(`/api/logs-actions/audit?${params.toString()}`, { cache: "no-store" });
        const data = await parseResponse<AuditLogsResponse>(response);
        setAuditData(data);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to load logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeModule, auditAction, auditEntityId, auditLevel, auditPage, auditStatus, emailCategory, emailPage, emailStatus, search]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setSelectedEmailIds([]);
  }, [emailData?.items]);

  const submitBulkRetry = async (mode: "selected" | "all-failed", ids: string[]) => {
    setActionLoading(true);
    setActionMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/logs-actions/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ids }),
      });

      const result = await parseResponse<{ requested: number; retried: number; failed: number }>(response);
      setActionMessage(`Retry completed: ${result.retried}/${result.requested} succeeded.`);
      setSelectedEmailIds([]);
      await fetchLogs();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Bulk retry failed.";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const retrySingleEmail = async (emailLogId: string) => {
    setActionLoading(true);
    setActionMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/logs-actions/email/${emailLogId}/retry`, { method: "POST" });
      await parseResponse(response);
      setActionMessage("Email retry queued successfully.");
      await fetchLogs();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Retry failed.";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAllVisibleRetryable = () => {
    if (allVisibleRetryableSelected) {
      setSelectedEmailIds((previous) => previous.filter((id) => !retryableVisibleEmailIds.includes(id)));
      return;
    }

    setSelectedEmailIds((previous) => Array.from(new Set([...previous, ...retryableVisibleEmailIds])));
  };

  const toggleSelection = (id: string) => {
    setSelectedEmailIds((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setEmailPage(1);
              setAuditPage(1);
            }}
            placeholder="Search logs"
            className="w-64"
          />
          {activeModule === "email" ? (
            <>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                value={emailStatus}
                onChange={(event) => {
                  setEmailStatus(event.target.value as EmailStatus);
                  setEmailPage(1);
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="FAILED">Failed</option>
                <option value="RETRYING">Retrying</option>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
              </select>

              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                value={emailCategory}
                onChange={(event) => {
                  setEmailCategory(event.target.value as EmailCategory);
                  setEmailPage(1);
                }}
              >
                <option value="ALL">All categories</option>
                <option value="CANDIDATE_WELCOME">Candidate Welcome</option>
                <option value="TWO_FACTOR">Two Factor</option>
                <option value="SYSTEM">System</option>
              </select>
            </>
          ) : (
            <>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                value={auditLevel}
                onChange={(event) => {
                  setAuditLevel(event.target.value as AuditLevel);
                  setAuditPage(1);
                }}
              >
                <option value="ALL">All levels</option>
                <option value="INFO">Info</option>
                <option value="WARN">Warn</option>
                <option value="ERROR">Error</option>
              </select>

              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                value={auditAction}
                onChange={(event) => {
                  setAuditAction(event.target.value as AuditAction);
                  setAuditPage(1);
                }}
              >
                <option value="ALL">All actions</option>
                <option value="CREATED">Created</option>
                <option value="UPDATED">Updated</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="MAIL_SENT">Mail Sent</option>
                <option value="MAIL_FAILED">Mail Failed</option>
                <option value="MAIL_RETRIED">Mail Retried</option>
                <option value="LOGIN">Login</option>
                <option value="TWO_FACTOR">Two Factor</option>
                <option value="RETRY">Retry</option>
              </select>

              <Input
                value={auditEntityId}
                onChange={(event) => {
                  setAuditEntityId(event.target.value);
                  setAuditPage(1);
                }}
                placeholder="Filter by entity ID"
                className="w-52"
              />

              <Input
                value={auditStatus}
                onChange={(event) => {
                  setAuditStatus(event.target.value);
                  setAuditPage(1);
                }}
                placeholder={activeModule === "program" ? "Status (default PROGRAM)" : "Filter by status"}
                className="w-52"
              />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODULE_CONFIG.map((module) => (
          <Button
            key={module.key}
            type="button"
            size="sm"
            variant={activeModule === module.key ? "default" : "secondary"}
            onClick={() => {
              setActiveModule(module.key);
              setEmailPage(1);
              setAuditPage(1);
              setActionMessage(null);
              setError(null);
            }}
          >
            {module.label}
          </Button>
        ))}
      </div>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      {actionMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{actionMessage}</p> : null}

      {activeModule === "email" ? (
        <Card>
          <CardHeader>
            <CardTitle>Email Delivery Logs</CardTitle>
            <CardDescription>Retry failed deliveries individually or in bulk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-500">
                Showing <span className="font-bold text-slate-900">{emailData?.items.length ?? 0}</span> of{" "}
                <span className="font-bold text-slate-900">{emailData?.totalCount ?? 0}</span> email logs.
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={selectedEmailIds.length === 0 || actionLoading} onClick={() => void submitBulkRetry("selected", selectedEmailIds)}>
                  Retry Selected ({selectedEmailIds.length})
                </Button>
                <Button type="button" size="sm" variant="default" disabled={actionLoading} onClick={() => void submitBulkRetry("all-failed", [])}>
                  Retry All Failed
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select all retryable rows"
                        checked={allVisibleRetryableSelected}
                        onChange={toggleAllVisibleRetryable}
                        disabled={retryableVisibleEmailIds.length === 0}
                      />
                    </TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead>Last Attempt</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(emailData?.items ?? []).map((item) => {
                    const isRetryable = item.status === "FAILED";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.id}`}
                            checked={selectedEmailIds.includes(item.id)}
                            onChange={() => toggleSelection(item.id)}
                            disabled={!isRetryable}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{item.toEmail}</TableCell>
                        <TableCell className="max-w-xs truncate font-medium text-slate-700">{item.subject}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.attemptCount}</TableCell>
                        <TableCell>{formatDateTime(item.lastAttemptAt)}</TableCell>
                        <TableCell className={cn("max-w-xs truncate", item.errorMessage ? "text-rose-700" : "text-slate-500")}>{item.errorMessage ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                                <MoreHorizontal className="h-5 w-5" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={!isRetryable || actionLoading} onSelect={() => void retrySingleEmail(item.id)}>
                                Retry
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {loading ? <p className="text-sm text-slate-500">Loading logs...</p> : null}
            {!loading && (emailData?.items.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No email logs found.</p> : null}

            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" disabled={(emailData?.page ?? 1) <= 1 || loading} onClick={() => setEmailPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <span className="text-sm font-semibold text-slate-600">
                Page {emailData?.page ?? 1} / {emailData?.pageCount ?? 1}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(emailData?.page ?? 1) >= (emailData?.pageCount ?? 1) || loading}
                onClick={() => setEmailPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{activeModule[0].toUpperCase() + activeModule.slice(1)} Logs</CardTitle>
            <CardDescription>Operational activity for this module from the unified audit stream.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-500">
              Showing <span className="font-bold text-slate-900">{auditData?.items.length ?? 0}</span> of <span className="font-bold text-slate-900">{auditData?.totalCount ?? 0}</span> audit logs.
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditData?.items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell>{item.action}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(item.level)}>{item.level}</Badge>
                      </TableCell>
                      <TableCell>{item.status ?? "-"}</TableCell>
                      <TableCell>{item.entityId ?? "-"}</TableCell>
                      <TableCell className="max-w-xl font-medium text-slate-700">{item.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {loading ? <p className="text-sm text-slate-500">Loading logs...</p> : null}
            {!loading && (auditData?.items.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No logs found for this module.</p> : null}

            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" disabled={(auditData?.page ?? 1) <= 1 || loading} onClick={() => setAuditPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <span className="text-sm font-semibold text-slate-600">
                Page {auditData?.page ?? 1} / {auditData?.pageCount ?? 1}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(auditData?.page ?? 1) >= (auditData?.pageCount ?? 1) || loading}
                onClick={() => setAuditPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
