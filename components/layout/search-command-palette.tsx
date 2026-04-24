"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Clock,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Languages,
  Library,
  Loader2,
  Search,
  Users,
  Users2,
  X,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { searchAction } from "@/app/(portal)/search/actions";
import type { DashboardSearchResult, DashboardSearchSection } from "@/types";

type SearchCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SECTION_CONFIG: Record<
  DashboardSearchSection,
  { label: string; icon: React.ElementType; badgeVariant: "info" | "warning" | "accent" | "success" | "default" | "danger" }
> = {
  insights: { label: "Insights", icon: Search, badgeVariant: "default" },
  learners: { label: "Learners", icon: Users, badgeVariant: "info" },
  batches: { label: "Batches", icon: Users2, badgeVariant: "warning" },
  trainers: { label: "Trainers", icon: GraduationCap, badgeVariant: "accent" },
  programs: { label: "Programs", icon: Library, badgeVariant: "success" },
  courses: { label: "Courses", icon: BookOpen, badgeVariant: "default" },
  assessments: { label: "Assessments", icon: ClipboardCheck, badgeVariant: "danger" },
  curriculum: { label: "Curriculum", icon: BookOpen, badgeVariant: "info" },
  centres: { label: "Training Centres", icon: Building2, badgeVariant: "default" },
  course_content: { label: "Course Content", icon: FileText, badgeVariant: "default" },
  users: { label: "Users", icon: Users, badgeVariant: "info" },
  learning_resources: { label: "Learning Resources", icon: Library, badgeVariant: "success" },
  language_lab: { label: "Language Lab", icon: Languages, badgeVariant: "accent" },
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-yellow-100 px-0.5 text-inherit">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function SearchCommandPalette({ open, onOpenChange }: SearchCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DashboardSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { searches: recentSearches, addSearch, removeSearch } = useRecentSearches();

  // Search on debounced query change
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchAction({ query: debouncedQuery.trim() })
      .then((result) => {
        if (!cancelled) {
          setResults(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setLoading(false);
    }
  }, [open]);

  const handleSelect = useCallback(
    (href: string) => {
      if (query.trim().length >= 2) {
        addSearch(query.trim());
      }
      onOpenChange(false);
      router.push(href);
    },
    [query, addSearch, onOpenChange, router],
  );

  const handleRecentSelect = useCallback(
    (recent: string) => {
      setQuery(recent);
    },
    [],
  );

  const handleViewAllResults = useCallback(() => {
    if (query.trim().length >= 2) {
      addSearch(query.trim());
      onOpenChange(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, addSearch, onOpenChange, router]);

  const hasResults = results && results.total > 0;
  const showRecents = query.trim().length < 2 && recentSearches.length > 0;
  const showEmpty = !loading && debouncedQuery.trim().length >= 2 && results && results.total === 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search learners, batches, trainers, assessments, curriculum..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}

        {showEmpty && (
          <CommandEmpty>
            No results found for &ldquo;{debouncedQuery}&rdquo;.
            <br />
            <span className="text-xs text-slate-400">Try a different spelling or keyword.</span>
          </CommandEmpty>
        )}

        {showRecents && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((recent) => (
              <CommandItem
                key={recent}
                value={`recent:${recent}`}
                onSelect={() => handleRecentSelect(recent)}
                className="group"
              >
                <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-sm">{recent}</span>
                <button
                  className="ml-auto rounded-full p-1 opacity-0 transition-opacity hover:bg-slate-100 group-data-[selected=true]:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSearch(recent);
                  }}
                >
                  <X className="h-3 w-3 text-slate-400" />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!loading && hasResults && (
          <>
            {results.groups.map((group) => {
              const config = SECTION_CONFIG[group.key] ?? SECTION_CONFIG.insights;
              const Icon = config.icon;

              return (
                <CommandGroup key={group.key} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={`${item.section}-${item.id}`}
                      value={`${item.section}:${item.title}:${item.id}`}
                      onSelect={() => handleSelect(item.href)}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {highlightMatch(item.title, debouncedQuery)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>
                      {item.metadata && Object.entries(item.metadata).slice(0, 1).map(([key, value]) => (
                        <Badge key={key} variant={config.badgeVariant} className="ml-auto shrink-0 text-[10px]">
                          {value}
                        </Badge>
                      ))}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="view-all-results"
                onSelect={handleViewAllResults}
                className="justify-center text-primary"
              >
                <Search className="h-4 w-4" />
                <span className="text-sm font-medium">View all results for &ldquo;{query}&rdquo;</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {!loading && !hasResults && !showRecents && !showEmpty && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">Search across the academy</p>
            <p className="mt-1 text-xs text-slate-400">
              Find learners, batches, trainers, assessments, curriculum, and more.
            </p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
