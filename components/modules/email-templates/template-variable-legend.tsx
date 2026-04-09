"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CanAccess } from "@/components/ui/can-access";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VariableItem = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  category: string;
  sampleValue: string | null;
  isSystem: boolean;
};

type VariableGroup = {
  category: string;
  variables: VariableItem[];
};

const CATEGORY_ORDER = [
  "Branding",
  "Recipient",
  "General",
  "Authentication",
  "User Management",
  "Course & Program",
  "Assessment",
  "Notification",
];

function groupByCategory(items: VariableItem[]): VariableGroup[] {
  const map = new Map<string, VariableItem[]>();
  for (const item of items) {
    const list = map.get(item.category);
    if (list) {
      list.push(item);
    } else {
      map.set(item.category, [item]);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const iA = CATEGORY_ORDER.indexOf(a);
      const iB = CATEGORY_ORDER.indexOf(b);
      const rA = iA === -1 ? CATEGORY_ORDER.length : iA;
      const rB = iB === -1 ? CATEGORY_ORDER.length : iB;
      return rA - rB || a.localeCompare(b);
    })
    .map(([category, variables]) => ({ category, variables }));
}

type NewVariableForm = {
  name: string;
  label: string;
  description: string;
  category: string;
  sampleValue: string;
};

const emptyForm: NewVariableForm = {
  name: "",
  label: "",
  description: "",
  category: "",
  sampleValue: "",
};

export function TemplateVariableLegend() {
  const [variables, setVariables] = useState<VariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewVariableForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchVariables = useCallback(async () => {
    try {
      const res = await fetch("/api/email-template-variables");
      const payload = await res.json();
      if (payload.data) {
        setVariables(payload.data);
      }
    } catch {
      toast.error("Failed to load template variables.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVariables();
  }, [fetchVariables]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }, [variables, searchQuery]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.label.trim() || !form.category.trim()) {
      toast.error("Name, label, and category are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/email-template-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          label: form.label.trim(),
          description: form.description.trim() || null,
          category: form.category.trim(),
          sampleValue: form.sampleValue.trim() || null,
        }),
      });
      const payload = await res.json();

      if (!res.ok) {
        toast.error(payload.error || "Failed to create variable.");
        return;
      }

      toast.success(`Variable "{{${payload.data.name}}}" created.`);
      setForm(emptyForm);
      setShowForm(false);
      await fetchVariables();
    } catch {
      toast.error("Failed to create variable.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (variable: VariableItem) => {
    if (variable.isSystem) return;

    setDeletingId(variable.id);
    try {
      const res = await fetch(`/api/email-template-variables/${variable.id}`, {
        method: "DELETE",
      });
      const payload = await res.json();

      if (!res.ok) {
        toast.error(payload.error || "Failed to delete variable.");
        return;
      }

      toast.success(`Variable "{{${variable.name}}}" deleted.`);
      await fetchVariables();
    } catch {
      toast.error("Failed to delete variable.");
    } finally {
      setDeletingId(null);
    }
  };

  const existingCategories = useMemo(
    () => Array.from(new Set(variables.map((v) => v.category))).sort(),
    [variables]
  );

  if (loading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Template Variables</CardTitle>
          <CardDescription>Loading available variables…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Template Variables</CardTitle>
            <CardDescription className="mt-1">
              {variables.length} variable{variables.length !== 1 ? "s" : ""} available
              &mdash; use <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{"{{variableName}}"}</code> syntax in templates.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Collapse" : "Show Variables"}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {/* Search & actions bar */}
          <div className="mb-4 flex items-center gap-3">
            <Input
              placeholder="Search variables…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <CanAccess permission="email_templates.create">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "Cancel" : "Add Variable"}
              </Button>
            </CanAccess>
          </div>

          {/* Inline create form */}
          {showForm && (
            <Card className="mb-6 border-dashed border-[#0d3b84]/30 bg-slate-50/60">
              <CardContent className="pt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  New Custom Variable
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. customGreeting"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Letters, numbers, underscores. Starts with a letter.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Label <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Custom Greeting"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. General"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      list="variable-category-options"
                    />
                    <datalist id="variable-category-options">
                      {existingCategories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Sample Value
                    </label>
                    <Input
                      placeholder="e.g. Hello there!"
                      value={form.sampleValue}
                      onChange={(e) => setForm({ ...form, sampleValue: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Description
                    </label>
                    <Input
                      placeholder="Optional short description…"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    disabled={submitting}
                    onClick={handleCreate}
                  >
                    {submitting ? "Saving…" : "Save Variable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Variable groups */}
          {groups.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              {searchQuery ? "No variables match your search." : "No variables available."}
            </p>
          )}

          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.category}>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  {group.category}
                </p>
                <div className="overflow-hidden rounded-xl border border-[#edf1f5]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Variable</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="hidden lg:table-cell">Description</TableHead>
                        <TableHead className="hidden md:table-cell">Sample</TableHead>
                        <TableHead className="w-[100px] text-right">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.variables.map((variable) => (
                        <TableRow key={variable.id}>
                          <TableCell>
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-[#0d3b84]">
                              {`{{${variable.name}}}`}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-700">
                            {variable.label}
                          </TableCell>
                          <TableCell className="hidden text-xs text-slate-500 lg:table-cell">
                            {variable.description || "—"}
                          </TableCell>
                          <TableCell className="hidden text-xs text-slate-400 md:table-cell">
                            {variable.sampleValue || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {variable.isSystem ? (
                                <Badge variant="info">System</Badge>
                              ) : (
                                <Badge variant="accent">Custom</Badge>
                              )}
                              {!variable.isSystem && (
                                <CanAccess permission="email_templates.delete">
                                  <button
                                    className="text-xs text-rose-400 hover:text-rose-600 disabled:opacity-40"
                                    disabled={deletingId === variable.id}
                                    onClick={() => handleDelete(variable)}
                                    title="Delete variable"
                                  >
                                    ✕
                                  </button>
                                </CanAccess>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
