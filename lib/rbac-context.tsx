"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

const SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";

type RoleInfo = {
  code: string;
  name: string;
};

type UserInfo = {
  name: string;
  email: string;
};

type RbacContextValue = {
  permissions: Set<string>;
  roleCodes: string[];
  roles: RoleInfo[];
  user: UserInfo | null;
  isLoading: boolean;
  can: (permissionKey: string) => boolean;
  canAny: (permissionKeys: string[]) => boolean;
  hasRole: (roleCode: string) => boolean;
};

const RbacContext = createContext<RbacContextValue | null>(null);

async function fetchPermissions(): Promise<{ permissions: string[]; roleCodes: string[]; roles: RoleInfo[]; user: UserInfo | null }> {
  const response = await fetch("/api/auth/permissions", { credentials: "include" });

  if (!response.ok) {
    throw new Error("Permission fetch failed");
  }

  const json = await response.json();
  return json.data ?? { permissions: [], roleCodes: [], roles: [], user: null };
}

const AUTH_ROUTES = new Set(["/login", "/forgot-password", "/reset-password"]);

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.has(pathname) || pathname.startsWith("/login/") || pathname.startsWith("/forgot-") || pathname.startsWith("/reset-");
}

export function RbacProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enabled = !isAuthRoute(pathname);

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["auth", "permissions"],
    queryFn: fetchPermissions,
    staleTime: 5 * 60_000,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
    enabled,
  });

  const isLoading = enabled && queryLoading;

  const value = useMemo<RbacContextValue>(() => {
    const permSet = new Set(data?.permissions ?? []);
    const roleCodes = data?.roleCodes ?? [];
    const roles = data?.roles ?? [];
    const user = data?.user ?? null;
    const isSuperAdmin = roleCodes.includes(SUPER_ADMIN_ROLE_CODE);

    return {
      permissions: permSet,
      roleCodes,
      roles,
      user,
      isLoading,
      can: (key: string) => isSuperAdmin || permSet.has(key),
      canAny: (keys: string[]) => isSuperAdmin || keys.some((key) => permSet.has(key)),
      hasRole: (code: string) => roleCodes.includes(code),
    };
  }, [data, isLoading]);

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}

export function useRbac(): RbacContextValue {
  const context = useContext(RbacContext);

  if (!context) {
    throw new Error("useRbac must be used within an RbacProvider.");
  }

  return context;
}
