"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BookOpen, CalendarCheck, ClipboardList, HeartPulse, HelpCircle, Layers, LayoutDashboard, Mic2, Network, Settings, UserCog, Users, Wallet } from "lucide-react";

import academyLogo from "@/Logo 9-02.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardUI } from "@/hooks/use-dashboard-ui";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/learners", label: "Learners", icon: Users },
      { href: "/courses", label: "Courses", icon: BookOpen },
      { href: "/programs", label: "Programs", icon: BookOpen },
      { href: "/batches", label: "Batches", icon: Layers },
      { href: "/trainers", label: "Trainers", icon: UserCog },
      { href: "/overview", label: "Overview", icon: Network },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/assessments", label: "Assessments", icon: ClipboardList },
      { href: "/certifications", label: "Certifications", icon: Award },
      { href: "/readiness", label: "Readiness Engine", icon: HeartPulse },
      { href: "/language-lab", label: "Language Lab", icon: Mic2 },
    ],
  },
  {
    label: "Back Office",
    items: [
      { href: "/payments", label: "Fees & Payments", icon: Wallet },
      { href: "/support", label: "Support Tickets", icon: HelpCircle },
      { href: "/settings", label: "System Config", icon: Settings },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname() ?? "/dashboard";
  const setMobileSidebarOpen = useDashboardUI((state) => state.setMobileSidebarOpen);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      setMobileSidebarOpen(false);
      previousPathnameRef.current = pathname;
      return;
    }

    previousPathnameRef.current = pathname;
  }, [pathname, setMobileSidebarOpen]);

  return (
    <div className="flex h-full flex-col py-4">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3 overflow-hidden px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
            <Image src={academyLogo} alt="GTS Academy" className="h-full w-full object-scale-down" priority />
          </div>
          <div className="min-w-0 transition-all group-data-[collapsed=true]/sidebar:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-400">Admin Operations</p>
          </div>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-6 overflow-y-auto px-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 group-data-[collapsed=true]/sidebar:hidden">{group.label}</p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        ))}
      </nav>

      <div className="border-t border-slate-100 px-4 pt-4">
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl p-2 transition-colors hover:bg-slate-50">
          <Avatar className="h-10 w-10 border border-slate-100 bg-slate-100">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=AdminArunima" alt="Arunima Singh" />
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <div className="min-w-0 transition-all group-data-[collapsed=true]/sidebar:hidden">
            <p className="truncate text-sm font-bold text-slate-900">Arunima Singh</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Operations Head</p>
          </div>
        </div>
      </div>
    </div>
  );
}