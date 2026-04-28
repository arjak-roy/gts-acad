"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, BookOpen, Building2, CalendarCheck, CalendarClock, CalendarDays, ClipboardCheck, ClipboardList, FolderOpen, GraduationCap, HeartPulse, HelpCircle, Layers, LayoutDashboard, Mail, Mic2, ScrollText, Settings, Shield, UserCheck, UserCog, Users, Wallet, Workflow } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardUI } from "@/hooks/use-dashboard-ui";
import { useRbac } from "@/lib/rbac-context";
import { routePermissionMap, type PermissionRequirement } from "@/lib/rbac-config";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  requiredPermission?: PermissionRequirement;
  matchMode?: "exact" | "prefix";
};

function canAccessRequirement(
  requirement: PermissionRequirement | undefined,
  can: (permissionKey: string) => boolean,
  canAny: (permissionKeys: string[]) => boolean,
) {
  if (!requirement) {
    return true;
  }

  return Array.isArray(requirement) ? canAny(requirement) : can(requirement);
}

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    // Top-level monitoring and summary views.
    label: "Home",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, requiredPermission: routePermissionMap["/dashboard"] },
      { href: "/overview", label: "Overview", icon: BarChart3, requiredPermission: routePermissionMap["/overview"] },
    ],
  },
  {
    // All humans enrolled or teaching in the academy.
    label: "People",
    items: [
      { href: "/learners", label: "Learners", icon: Users, requiredPermission: routePermissionMap["/learners"] },
      { href: "/trainers", label: "Trainers", icon: UserCheck, requiredPermission: routePermissionMap["/trainers"] },
    ],
  },
  {
    // Structural scaffolding — what the academy offers and where.
    label: "Academy",
    items: [
      { href: "/courses", label: "Courses", icon: BookOpen, requiredPermission: routePermissionMap["/courses"] },
      { href: "/programs", label: "Programs", icon: GraduationCap, requiredPermission: routePermissionMap["/programs"] },
      { href: "/batches", label: "Batches", icon: Layers, requiredPermission: routePermissionMap["/batches"] },
      { href: "/centers", label: "Centers", icon: Building2, requiredPermission: routePermissionMap["/centers"] },
    ],
  },
  {
    // Authoring tools — what gets taught.
    label: "Content",
    items: [
      { href: "/course-builder", label: "Learning Resources", icon: FolderOpen, requiredPermission: routePermissionMap["/course-builder"] },
      { href: "/curriculum-builder", label: "Curriculum Builder", icon: Workflow, requiredPermission: routePermissionMap["/curriculum-builder"] },
    ],
  },
  {
    // Day-to-day delivery — how learning is conducted.
    label: "Delivery",
    items: [
      { href: "/schedule", label: "Schedule", icon: CalendarDays, requiredPermission: routePermissionMap["/schedule"] },
      { href: "/trainer-sessions", label: "Trainer Sessions", icon: CalendarClock, requiredPermission: routePermissionMap["/trainer-sessions"] },
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck, requiredPermission: routePermissionMap["/attendance"] },
      { href: "/language-lab", label: "Language Lab", icon: Mic2, requiredPermission: routePermissionMap["/language-lab"] },
    ],
  },
  {
    // How learners are evaluated, reviewed, and graduated.
    label: "Assessment",
    items: [
      { href: "/assessments", label: "Assessments", icon: ClipboardList, requiredPermission: routePermissionMap["/assessments"] },
      { href: "/assessments/reviews", label: "Review Queue", icon: CalendarCheck, requiredPermission: routePermissionMap["/assessments/reviews"] },
      { href: "/certifications", label: "Certifications", icon: Award, requiredPermission: routePermissionMap["/certifications"] },
      { href: "/readiness", label: "Placement Readiness", icon: HeartPulse, requiredPermission: routePermissionMap["/readiness"] },
    ],
  },
  {
    // Finance and learner support workflows.
    label: "Operations",
    items: [
      { href: "/payments", label: "Fees & Payments", icon: Wallet, requiredPermission: routePermissionMap["/payments"] },
      { href: "/support", label: "Support Tickets", icon: HelpCircle, requiredPermission: routePermissionMap["/support"] },
    ],
  },
  {
    // Platform administration — staff, permissions, audit, and configuration.
    label: "System",
    items: [
      { href: "/users", label: "Staff Users", icon: UserCog, requiredPermission: routePermissionMap["/users"] },
      { href: "/roles", label: "Roles & Permissions", icon: Shield, requiredPermission: routePermissionMap["/roles"] },
      { href: "/logs-actions", label: "Audit Logs", icon: ScrollText, requiredPermission: routePermissionMap["/logs-actions"] },
      { href: "/settings", label: "Settings", icon: Settings, requiredPermission: routePermissionMap["/settings"], matchMode: "exact" },
      { href: "/settings/email-templates", label: "Email Templates", icon: Mail, requiredPermission: routePermissionMap["/settings/email-templates"] },
    ],
  },
];

const sidebarLoadingGroups = [
  { labelWidth: "w-12", itemCount: 2 },
  { labelWidth: "w-16", itemCount: 2 },
  { labelWidth: "w-20", itemCount: 4 },
  { labelWidth: "w-16", itemCount: 2 },
  { labelWidth: "w-20", itemCount: 4 },
  { labelWidth: "w-24", itemCount: 4 },
  { labelWidth: "w-24", itemCount: 2 },
  { labelWidth: "w-16", itemCount: 5 },
];

function SidebarNavLoading() {
  return (
    <div className="flex h-full flex-col py-4" aria-hidden="true">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3 overflow-hidden px-2">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 space-y-2 transition-all group-data-[collapsed=true]/sidebar:hidden">
            <Skeleton className="h-2.5 w-24 rounded-full" />
            <Skeleton className="h-4 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-6 overflow-y-auto px-3">
        {sidebarLoadingGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            <Skeleton className={cn("mx-3 h-2.5 rounded-full group-data-[collapsed=true]/sidebar:hidden", group.labelWidth)} />
            <div className="mt-2 space-y-1">
              {Array.from({ length: group.itemCount }).map((_, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  <Skeleton className="h-5 w-5 shrink-0 rounded-lg" />
                  <Skeleton className="h-4 flex-1 rounded-full transition-all group-data-[collapsed=true]/sidebar:hidden" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-4 pt-4">
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl p-2">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 transition-all group-data-[collapsed=true]/sidebar:hidden">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname() ?? "/dashboard";
  const setMobileSidebarOpen = useDashboardUI((state) => state.setMobileSidebarOpen);
  const previousPathnameRef = useRef(pathname);
  const { can, canAny, isLoading, roles, user } = useRbac();

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      setMobileSidebarOpen(false);
      previousPathnameRef.current = pathname;
      return;
    }

    previousPathnameRef.current = pathname;
  }, [pathname, setMobileSidebarOpen]);

  const primaryRole = roles[0];
  const displayName = user?.name ?? "Loading...";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (isLoading) {
    return <SidebarNavLoading />;
  }

  return (
    <div className="flex h-full flex-col py-4">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3 overflow-hidden px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
            <Image src="/api/branding/application-logo" alt="GTS Academy" width={44} height={44} className="h-full w-full object-scale-down" priority unoptimized />
          </div>
          <div className="min-w-0 transition-all group-data-[collapsed=true]/sidebar:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-400">Admin Operations</p>
          </div>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-6 overflow-y-auto px-3">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => canAccessRequirement(item.requiredPermission, can, canAny));

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 group-data-[collapsed=true]/sidebar:hidden">{group.label}</p>
              <div className="mt-2 space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.matchMode === "exact"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition-colors",
                        active ? "bg-[#eef2ff] text-primary" : "hover:bg-slate-50 hover:text-primary",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate transition-all group-data-[collapsed=true]/sidebar:hidden">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-4 pt-4">
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl p-2 transition-colors hover:bg-slate-50">
          <Avatar className="h-10 w-10 border border-slate-100 bg-slate-100">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email ?? "user")}`} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 transition-all group-data-[collapsed=true]/sidebar:hidden">
            <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{primaryRole?.name ?? (isLoading ? "Loading..." : "No role")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}