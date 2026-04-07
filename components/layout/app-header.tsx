"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Menu, Plus, Search, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDashboardUI } from "@/hooks/use-dashboard-ui";
import { useDebounce } from "@/hooks/use-debounce";
import { useRbac } from "@/lib/rbac-context";

export function AppHeader() {
  const shouldRedirectFromHeader = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toggleSidebar = useDashboardUI((state) => state.toggleSidebar);
  const toggleMobileSidebar = useDashboardUI((state) => state.toggleMobileSidebar);
  const queryClient = useQueryClient();
  const { user, roles } = useRbac();
  const primaryRole = roles[0];
  const isDashboardPage = pathname === "/dashboard";
  const isSearchPage = pathname === "/search";
  const initialQuery = isDashboardPage ? searchParams.get("query") ?? "" : isSearchPage ? searchParams.get("q") ?? "" : "";
  const [search, setSearch] = useState(initialQuery);
  const debouncedSearch = useDebounce(search, 300);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.removeQueries({ queryKey: ["auth", "permissions"] });
      router.replace("/login");
      router.refresh();
    }
  };

  useEffect(() => {
    shouldRedirectFromHeader.current = false;
    setSearch(initialQuery);
  }, [initialQuery, pathname]);

  useEffect(() => {
    const normalizedSearch = debouncedSearch.trim();

    // Skip if we're on dashboard and the value hasn't changed
    if (isDashboardPage && debouncedSearch === initialQuery) {
      return;
    }

    // Skip if we're not on dashboard/search and haven't triggered a redirect
    if (!isDashboardPage && !isSearchPage) {
      if (!shouldRedirectFromHeader.current || normalizedSearch.length < 2) {
        return;
      }
    }

    // Route to search page for dedicated search experience
    if (!isSearchPage && normalizedSearch.length >= 2) {
      const params = new URLSearchParams();
      params.set("q", normalizedSearch);
      startTransition(() => {
        router.replace(`/search?${params.toString()}`, { scroll: false });
      });
      shouldRedirectFromHeader.current = false;
      return;
    }

    // Clear search when too short or empty on search page
    if (isSearchPage && normalizedSearch.length < 2) {
      startTransition(() => {
        router.replace("/search", { scroll: false });
      });
      return;
    }

    // Update url param on search page
    if (isSearchPage && normalizedSearch.length >= 2) {
      const params = new URLSearchParams();
      params.set("q", normalizedSearch);
      startTransition(() => {
        router.replace(`/search?${params.toString()}`, { scroll: false });
      });
      return;
    }

  }, [debouncedSearch, initialQuery, isDashboardPage, isSearchPage, router, searchParams]);

  return (
    <header className="sticky top-0 z-20 border-b border-[#dde1e6] bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-3 md:gap-4 md:px-6">
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="inline-flex lg:hidden" onClick={toggleMobileSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative mx-1 min-w-0 max-w-2xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => {
              shouldRedirectFromHeader.current = true;
              setSearch(event.target.value);
            }}
            className="rounded-full border-slate-200 bg-slate-50 pl-10 pr-10 md:pr-16"
            placeholder="Search learners, batches, trainers, certificates..."
          />
          <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400 md:inline-flex">
            Ctrl+K
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="h-9 w-9 rounded-full shadow-sm md:h-10 md:w-10 md:shadow-md">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <CanAccess permission="users.create">
                <DropdownMenuItem asChild>
                  <Link href="/learners">Enroll Learner</Link>
                </DropdownMenuItem>
              </CanAccess>
              <CanAccess permission="courses.create">
                <DropdownMenuItem asChild>
                  <Link href="/courses">Create Course</Link>
                </DropdownMenuItem>
              </CanAccess>
              <CanAccess permission="programs.create">
                <DropdownMenuItem asChild>
                  <Link href="/programs">Create Program</Link>
                </DropdownMenuItem>
              </CanAccess>
              <CanAccess permission="batches.create">
                <DropdownMenuItem asChild>
                  <Link href="/batches">Create Batch</Link>
                </DropdownMenuItem>
              </CanAccess>
              <DropdownMenuSeparator />
              <CanAccess permission="assessment_pool.view">
                <DropdownMenuItem asChild>
                  <Link href="/assessments">Assessment Builder</Link>
                </DropdownMenuItem>
              </CanAccess>
              <CanAccess permission="certifications.create">
                <DropdownMenuItem asChild>
                  <Link href="/certifications">Issue Certificate</Link>
                </DropdownMenuItem>
              </CanAccess>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full transition-shadow hover:ring-2 hover:ring-[#0d3b84]/20 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]">
                <Avatar className="h-9 w-9 border border-slate-100 bg-slate-100 md:h-10 md:w-10">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email ?? "user")}`} alt={user?.name ?? "User"} />
                  <AvatarFallback>
                    {(user?.name ?? "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="font-bold text-slate-900">{user?.name ?? "—"}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email ?? ""}</p>
                {primaryRole && (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.28em] text-primary">{primaryRole.name}</p>
                )}
              </div>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <CanAccess permission="sessions.view">
                <DropdownMenuItem asChild>
                  <Link href="/sessions">Session Management</Link>
                </DropdownMenuItem>
              </CanAccess>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600" onSelect={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}