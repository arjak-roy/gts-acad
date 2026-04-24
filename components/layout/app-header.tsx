"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Menu, Plus, Search, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchCommandPalette } from "@/components/layout/search-command-palette";
import { useDashboardUI } from "@/hooks/use-dashboard-ui";
import { useRbac } from "@/lib/rbac-context";

export function AppHeader() {
  const router = useRouter();
  const toggleSidebar = useDashboardUI((state) => state.toggleSidebar);
  const toggleMobileSidebar = useDashboardUI((state) => state.toggleMobileSidebar);
  const queryClient = useQueryClient();
  const { user, roles } = useRbac();
  const primaryRole = roles[0];
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.removeQueries({ queryKey: ["auth", "permissions"] });
      router.replace("/login");
      router.refresh();
    }
  };

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

        <button
          onClick={() => setPaletteOpen(true)}
          className="relative mx-1 flex min-w-0 max-w-2xl flex-1 cursor-pointer items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-colors hover:border-slate-300 hover:bg-slate-100"
        >
          <Search className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate text-sm text-slate-400">Search learners, batches, trainers, assessments...</span>
          <span className="ml-auto hidden shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400 md:inline-flex">
            Ctrl+K
          </span>
        </button>
        <SearchCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

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