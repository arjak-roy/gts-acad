"use client";

import type { ReactNode } from "react";

import { useRbac } from "@/lib/rbac-context";

type CanAccessProps = {
  permission?: string;
  any?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function CanAccess({ permission, any: anyPermissions, fallback = null, children }: CanAccessProps) {
  const { can, canAny } = useRbac();

  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  if (anyPermissions && anyPermissions.length > 0 && !canAny(anyPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
