"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useRbac } from "@/lib/rbac-context";
import { getRequiredPermission, type PermissionRequirement } from "@/lib/rbac-config";

function canAccessRequirement(
  requirement: PermissionRequirement | null,
  can: (permissionKey: string) => boolean,
  canAny: (permissionKeys: string[]) => boolean,
) {
  if (!requirement) {
    return true;
  }

  return Array.isArray(requirement) ? canAny(requirement) : can(requirement);
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, canAny, isLoading } = useRbac();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const requiredPermission = getRequiredPermission(pathname);

    if (!canAccessRequirement(requiredPermission, can, canAny)) {
      router.replace("/access-denied");
    }
  }, [pathname, can, canAny, isLoading, router]);

  if (isLoading) {
    return <>{children}</>;
  }

  const requiredPermission = getRequiredPermission(pathname);
  if (!canAccessRequirement(requiredPermission, can, canAny)) {
    return null;
  }

  return <>{children}</>;
}
