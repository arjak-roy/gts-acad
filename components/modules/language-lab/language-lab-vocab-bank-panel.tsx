"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  LanguageLabVocabBankImportCommitResult,
  LanguageLabVocabBankImportNormalizedRow,
  LanguageLabVocabBankImportPreview,
  LanguageLabWordItem,
} from "@/lib/language-lab/types";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type ManagedWordFilters = {
  search: string;
  isActive: "all" | "active" | "inactive";
};

type ManagedWordDraft = {
  word: string;
  englishMeaning: string;
  phonetic: string;
  difficulty: string;
  source: string;
  isActive: boolean;
};

const SELECT_CLASS_NAME =
  "flex h-11 w-full rounded-2xl border border-[#dde1e6] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS_NAME =
  "flex min-h-[116px] w-full rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY_WORD_DRAFT: ManagedWordDraft = {
  word: "",
  englishMeaning: "",
  phonetic: "",
  difficulty: "1",
  source: "manual",
  isActive: true,
};

const TEMPLATE_FILE_NAME = "language-lab-vocab-template.csv";

function formatCompactDate(value: string | null) {
  if (!value) {
    return "No data yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "No data yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(parsed);
}

function formatDifficultyStars(value: number) {
  const clamped = Math.min(5, Math.max(1, value));
  return Array.from({ length: clamped }, () => "* ").join("").trim();
}

function buildQueryString(params: Record<string, string | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = typeof value === "string" ? value.trim() : String(value);
    if (!normalized) {
      continue;
    }

    searchParams.set(key, normalized);
  }

  return searchParams.toString();
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.data === undefined) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body.data;
}

function toWordDraft(word: LanguageLabWordItem): ManagedWordDraft {
  return {
    word: word.word,
    englishMeaning: word.englishMeaning ?? "",
    phonetic: word.phonetic ?? "",
    difficulty: String(word.difficulty),
    source: word.source,
    isActive: word.isActive,
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function ImportStatusBadge({ status }: { status: LanguageLabVocabBankImportPreview["rows"][number]["status"] }) {
  const variant = status === "create" ? "success" : status === "update" ? "accent" : "danger";
  const label = status === "create" ? "Create" : status === "update" ? "Update" : "Error";

  return <Badge variant={variant}>{label}</Badge>;
}

export function LanguageLabVocabBankPanel() {
  const [wordFilters, setWordFilters] = useState<ManagedWordFilters>({ search: "", isActive: "all" });
  const [catalog, setCatalog] = useState<LanguageLabWordItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [draft, setDraft] = useState<ManagedWordDraft>(EMPTY_WORD_DRAFT);
  const [editingWord, setEditingWord] = useState<LanguageLabWordItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const deferredCatalogSearch = useDeferredValue(wordFilters.search);

  const loadCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    setCatalogError(null);

    try {
      const query = buildQueryString({
        search: deferredCatalogSearch,
        isActive:
          wordFilters.isActive === "all"
            ? undefined
            : wordFilters.isActive === "active",
      });
      const nextCatalog = await readApi<LanguageLabWordItem[]>(`/api/language-lab/words${query ? `?${query}` : ""}`);
      setCatalog(nextCatalog);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Failed to load vocab bank.");
    } finally {
      setIsCatalogLoading(false);
    }
  }, [deferredCatalogSearch, wordFilters.isActive]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const resetDraft = useCallback(() => {
    setEditingWord(null);
    setDraft(EMPTY_WORD_DRAFT);
  }, []);

  const startEditing = useCallback((word: LanguageLabWordItem) => {
    setEditingWord(word);
    setDraft(toWordDraft(word));
  }, []);

  const handleDraftFieldChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = event.target;

      setDraft((current) => ({
        ...current,
        [name]: value,
      }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);

      try {
        const difficulty = Number.parseInt(draft.difficulty, 10);
        const payload = {
          word: draft.word,
          englishMeaning: draft.englishMeaning,
          phonetic: draft.phonetic,
          difficulty: Number.isFinite(difficulty) ? difficulty : 1,
          source: draft.source,
          isActive: draft.isActive,
        };

        await readApi<LanguageLabWordItem>(
          editingWord ? `/api/language-lab/words/${editingWord.id}` : "/api/language-lab/words",
          {
            method: editingWord ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        toast.success(editingWord ? "Vocab bank word updated." : "Vocab bank word created.");
        resetDraft();
        await loadCatalog();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save vocab bank word.");
      } finally {
        setIsSaving(false);
      }
    },
    [draft, editingWord, loadCatalog, resetDraft],
  );

  const handleTemplateDownload = useCallback(async () => {
    setIsTemplateDownloading(true);

    try {
      const response = await fetch("/api/language-lab/vocab-bank/template", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to download vocab template.");
      }

      downloadBlob(await response.blob(), TEMPLATE_FILE_NAME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download vocab template.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  const activeCount = useMemo(
    () => catalog.filter((word) => word.isActive).length,
    [catalog],
  );
  const practicedCount = useMemo(
    () => catalog.filter((word) => word.lastPracticedAt !== null).length,
    [catalog],
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#d8e1ef] bg-[radial-gradient(circle_at_top_right,rgba(248,154,28,0.12),transparent_28%),radial-gradient(circle_at_top_left,rgba(13,59,132,0.1),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <CardContent className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Global vocab bank</Badge>
                <Badge variant="accent">CSV bulk upload</Badge>
                <Badge variant="success">Preview before commit</Badge>
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">Academy vocabulary bank</h2>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                Manage the academy-owned pronunciation catalog in one place, bulk import reusable words from CSV,
                and keep the candidate-facing vocabulary source explicit.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => void handleTemplateDownload()} disabled={isTemplateDownloading}>
                {isTemplateDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download template
              </Button>
              <CanAccess permission="lms.edit">
                <Button type="button" variant="accent" onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Bulk upload CSV
                </Button>
              </CanAccess>
              <Button type="button" variant="secondary" onClick={() => void loadCatalog()} disabled={isCatalogLoading}>
                {isCatalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh bank
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Words in view" value={String(catalog.length)} helper="Catalog rows matching the current bank filters." badge="Catalog" />
            <MetricCard label="Active words" value={String(activeCount)} helper="Rows currently available to candidate-facing fetches." badge="Live" badgeVariant="success" />
            <MetricCard label="Practiced words" value={String(practicedCount)} helper="Words already represented in synced pronunciation attempts." badge="Practice" badgeVariant="accent" />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <Input
              value={wordFilters.search}
              onChange={(event) => setWordFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search word, meaning, or phonetic"
            />
            <select
              className={SELECT_CLASS_NAME}
              value={wordFilters.isActive}
              onChange={(event) =>
                setWordFilters((current) => ({
                  ...current,
                  isActive: event.target.value as ManagedWordFilters["isActive"],
                }))
              }
            >
              <option value="all">All rollout states</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
        <Card className="border-[#d8e1ef] bg-white">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Managed vocab catalog</Badge>
              <Badge variant="default">Academy source of truth</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Reusable pronunciation words</CardTitle>
            <CardDescription className="max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Bulk upload new rows when the academy wants a larger rollout, then use manual edits here to fine-tune
              wording, phonetics, difficulty, and rollout state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {catalogError ? <InlineErrorCard title="Vocab bank unavailable" message={catalogError} onRetry={() => void loadCatalog()} /> : null}

            {isCatalogLoading ? (
              <LoadingRows label="Loading vocab bank" />
            ) : catalog.length === 0 ? (
              <EmptyStateCard
                title="No vocab bank rows found"
                description="Adjust the filters, import a CSV file, or create the first academy-managed word manually."
              />
            ) : (
              <div className="space-y-3">
                {catalog.map((word) => (
                  <div
                    key={word.id}
                    className="rounded-[24px] border border-[#e5ebf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black tracking-tight text-slate-950">{word.word}</p>
                          <Badge variant={word.isActive ? "success" : "warning"}>{word.isActive ? "Active" : "Inactive"}</Badge>
                          <Badge variant="default">{formatDifficultyStars(word.difficulty)}</Badge>
                          <Badge variant="accent">{word.source.replaceAll("_", " ")}</Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-600">
                          {word.englishMeaning || "No English meaning yet"}
                          {word.phonetic ? ` • ${word.phonetic}` : ""}
                        </p>
                      </div>

                      <CanAccess permission="lms.edit">
                        <Button type="button" variant="ghost" size="sm" onClick={() => startEditing(word)}>
                          <PencilLine className="h-4 w-4" />
                          Edit word
                        </Button>
                      </CanAccess>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MiniStat label="Attempts" value={String(word.pronunciationAttemptsCount)} />
                      <MiniStat label="Last practiced" value={formatCompactDate(word.lastPracticedAt)} />
                      <MiniStat label="Updated" value={formatCompactDate(word.updatedAt)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <CanAccess permission="lms.edit" fallback={<ReadOnlyWordCard />}>
          <Card className="border-[#d8e1ef] bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{editingWord ? "Edit bank row" : "New bank row"}</Badge>
                <Badge variant="info">Manual override</Badge>
              </div>
              <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                {editingWord ? `Update ${editingWord.word}` : "Create vocab bank word"}
              </CardTitle>
              <CardDescription className="text-sm font-medium leading-6 text-slate-600">
                Use this form for one-off edits after import or for adding a small set of hand-curated words.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">German word</span>
                  <Input name="word" value={draft.word} onChange={handleDraftFieldChange} placeholder="Guten Morgen" required />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">English meaning</span>
                  <Input
                    name="englishMeaning"
                    value={draft.englishMeaning}
                    onChange={handleDraftFieldChange}
                    placeholder="Good morning"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Phonetic guidance</span>
                  <textarea
                    name="phonetic"
                    value={draft.phonetic}
                    onChange={handleDraftFieldChange}
                    className={TEXTAREA_CLASS_NAME}
                    placeholder="GOO-ten MOR-gen"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Difficulty</span>
                    <select className={SELECT_CLASS_NAME} name="difficulty" value={draft.difficulty} onChange={handleDraftFieldChange}>
                      <option value="1">1 • Starter</option>
                      <option value="2">2 • Core vocabulary</option>
                      <option value="3">3 • Mid challenge</option>
                      <option value="4">4 • Advanced</option>
                      <option value="5">5 • Expert</option>
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Rollout</span>
                    <select
                      className={SELECT_CLASS_NAME}
                      name="isActive"
                      value={draft.isActive ? "true" : "false"}
                      onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.value === "true" }))}
                    >
                      <option value="true">Active for candidates</option>
                      <option value="false">Inactive draft</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Source tag</span>
                  <Input name="source" value={draft.source} onChange={handleDraftFieldChange} placeholder="manual" />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingWord ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingWord ? "Save changes" : "Create word"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetDraft} disabled={isSaving}>
                    Reset form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </CanAccess>
      </div>

      <VocabBankImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImported={async () => {
          await loadCatalog();
        }}
      />
    </div>
  );
}

function VocabBankImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LanguageLabVocabBankImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (open) {
      return;
    }

    setSelectedFile(null);
    setPreview(null);
    setFileInputKey((current) => current + 1);
  }, [open]);

  const actionableRows = useMemo(
    () => preview?.rows.flatMap((row) => (row.normalizedData ? [row.normalizedData] : [])) ?? [],
    [preview],
  );

  const handleTemplateDownload = useCallback(async () => {
    setIsTemplateDownloading(true);

    try {
      const response = await fetch("/api/language-lab/vocab-bank/template", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to download vocab template.");
      }

      downloadBlob(await response.blob(), TEMPLATE_FILE_NAME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download vocab template.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!selectedFile) {
      toast.info("Select a CSV file to preview.");
      return;
    }

    setIsPreviewing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const nextPreview = await readApi<LanguageLabVocabBankImportPreview>("/api/language-lab/vocab-bank/import/preview", {
        method: "POST",
        body: formData,
      });
      setPreview(nextPreview);
      toast.success(`Preview ready: ${nextPreview.actionableCount} actionable row${nextPreview.actionableCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Failed to preview vocab upload.");
    } finally {
      setIsPreviewing(false);
    }
  }, [selectedFile]);

  const handleImport = useCallback(async () => {
    if (!preview) {
      toast.info("Preview the CSV before importing.");
      return;
    }

    if (preview.hasBlockingErrors) {
      toast.info("Fix the blocking CSV errors before importing.");
      return;
    }

    if (actionableRows.length === 0) {
      toast.info("Preview contains no actionable rows.");
      return;
    }

    setIsImporting(true);

    try {
      const result = await readApi<LanguageLabVocabBankImportCommitResult>("/api/language-lab/vocab-bank/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: preview.fileName,
          rows: actionableRows,
        }),
      });

      await onImported();
      toast.success(`Imported ${result.totalCount} row${result.totalCount === 1 ? "" : "s"}: ${result.createdCount} created, ${result.updatedCount} updated.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import vocab rows.");
    } finally {
      setIsImporting(false);
    }
  }, [actionableRows, onImported, onOpenChange, preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[min(96vw,72rem)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>Bulk Upload Vocab Bank</DialogTitle>
          <DialogDescription>
            Upload a CSV, review every row before commit, and update existing words by normalized match instead of creating duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Card className="border-[#d8e1ef] bg-slate-50">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">CSV only</Badge>
                  <Badge variant="accent">Current word fields</Badge>
                </div>
                <CardTitle className="mt-3 text-xl font-black tracking-tight text-slate-950">Upload contract</CardTitle>
                <CardDescription className="text-sm font-medium leading-6 text-slate-600">
                  Required column: <span className="font-bold text-slate-800">word</span>. Optional columns: englishMeaning, phonetic,
                  difficulty, source, and isActive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[22px] border border-dashed border-[#cfd8e6] bg-white px-4 py-4">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">CSV file</span>
                    <input
                      key={fileInputKey}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setPreview(null);
                      }}
                      className="block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[#edf4ff] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#0d3b84]"
                    />
                  </label>
                  <p className="mt-3 text-sm font-medium text-slate-500">
                    {selectedFile ? `${selectedFile.name} selected` : "Choose the CSV file you want to preview."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={() => void handleTemplateDownload()} disabled={isTemplateDownloading}>
                    {isTemplateDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download template
                  </Button>
                  <Button type="button" onClick={() => void handlePreview()} disabled={!selectedFile || isPreviewing}>
                    {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Preview upload
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#d8e1ef] bg-white">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Create new rows</Badge>
                  <Badge variant="accent">Update existing rows</Badge>
                  <Badge variant="danger">Block on errors</Badge>
                </div>
                <CardTitle className="mt-3 text-xl font-black tracking-tight text-slate-950">Preview rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>Blank difficulty defaults to 1, blank source defaults to bulk_upload, and blank isActive defaults to true.</p>
                <p>Rows with the same normalized word inside the same file are blocked so the preview stays deterministic.</p>
                <p>Existing bank rows are matched by normalized word and will be updated on commit.</p>
              </CardContent>
            </Card>
          </div>

          {preview ? (
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Rows parsed" value={String(preview.totalRows)} helper={preview.fileName} badge="Rows" />
              <MetricCard label="Creates" value={String(preview.createCount)} helper="New vocab bank rows." badge="Create" badgeVariant="success" />
              <MetricCard label="Updates" value={String(preview.updateCount)} helper="Existing rows that will be refreshed." badge="Update" badgeVariant="accent" />
              <MetricCard label="Errors" value={String(preview.errorCount)} helper={preview.hasBlockingErrors ? "Commit is blocked until the file is fixed." : "No blocking errors."} badge="Errors" badgeVariant={preview.errorCount > 0 ? "danger" : "info"} />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden rounded-[24px] border border-[#d8e1ef] bg-white">
            {!preview ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">Preview a CSV file to inspect row actions.</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">The dialog will classify each row as create, update, or error before any database write happens.</p>
              </div>
            ) : preview.rows.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">No preview rows available.</p>
                <p className="mt-2 text-sm text-slate-500">Upload a CSV with at least one non-empty data row.</p>
              </div>
            ) : (
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Word</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Meaning</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => {
                    const normalizedRow = row.normalizedData as LanguageLabVocabBankImportNormalizedRow | null;

                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-bold text-slate-900">{row.rowNumber}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-bold text-slate-950">{row.input.word || "-"}</p>
                            <p className="text-xs font-medium text-slate-500">{row.normalizedWord || "No normalized match"}</p>
                            {row.existingWord ? <p className="text-xs font-semibold text-[#0d3b84]">Existing: {row.existingWord}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ImportStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{row.input.englishMeaning || normalizedRow?.englishMeaning || "-"}</TableCell>
                        <TableCell className="font-medium text-slate-700">
                          {normalizedRow?.difficulty !== undefined ? String(normalizedRow.difficulty) : (row.input.difficulty || "-")}
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">
                          {normalizedRow?.source !== undefined ? normalizedRow.source : (row.input.source || "-")}
                        </TableCell>
                        <TableCell>
                          {row.issues.length === 0 ? (
                            <p className="text-sm font-medium text-emerald-700">Ready to import</p>
                          ) : (
                            <div className="space-y-1">
                              {row.issues.map((issue, index) => (
                                <p key={`${row.rowNumber}-${issue.field ?? "general"}-${index}`} className="text-xs font-medium text-rose-700">
                                  {issue.field ? `${issue.field}: ` : ""}
                                  {issue.message}
                                </p>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isImporting || isPreviewing}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={!preview || preview.hasBlockingErrors || actionableRows.length === 0 || isImporting}
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Commit import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  helper,
  badge,
  badgeVariant = "default",
}: {
  label: string;
  value: string;
  helper: string;
  badge: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  return (
    <Card className="border-[#d8e1ef] bg-white">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          </div>
          <Badge variant={badgeVariant}>{badge}</Badge>
        </div>
        <p className="text-sm font-medium leading-6 text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#e5ebf4] bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function InlineErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="mb-4 rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-4">
      <p className="font-bold text-rose-700">{title}</p>
      <p className="mt-1 text-sm font-medium text-rose-600">{message}</p>
      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function EmptyStateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#d8e1ef] bg-slate-50 px-6 py-10 text-center">
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-label={label}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-[24px]" />
      ))}
    </div>
  );
}

function ReadOnlyWordCard() {
  return (
    <Card className="border-[#d8e1ef] bg-white">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Managed words protected</Badge>
          <Badge variant="default">Read-only session</Badge>
        </div>
        <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Editing requires LMS edit access</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium leading-6 text-slate-600">
          You can inspect the academy vocab bank here, but manual edits and bulk uploads are restricted to users with
          vocab-management permissions.
        </p>
      </CardContent>
    </Card>
  );
}